import { env } from "../config/env.js";
import { stripThinkingTags } from "../utils/sanitize.js";
import { metrics } from "../utils/metrics.js";

const DEFAULT_MAX_TOKENS = 16000;
const MAX_429_RETRIES = 2;

// ── Circuit breaker (§15.2: circuit/degraded behavior) ─────────────────────
// Prevents hammering a downed AI provider on every request.
// After FAILURE_THRESHOLD consecutive failures, the circuit opens for
// RESET_TIMEOUT_MS, during which all calls fail fast without hitting the network.

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000; // 30 seconds

const circuit = {
  failures: 0,
  state: "closed" as "closed" | "open" | "half-open",
  openedAt: 0,
};

function circuitIsOpen(): boolean {
  if (circuit.state === "open") {
    // Check if enough time has passed to try half-open
    if (Date.now() - circuit.openedAt > RESET_TIMEOUT_MS) {
      circuit.state = "half-open";
      return false;
    }
    return true;
  }
  return false;
}

function recordSuccess(): void {
  if (circuit.state === "half-open") {
    circuit.state = "closed";
  }
  circuit.failures = 0;
}

function recordFailure(): void {
  circuit.failures++;
  if (circuit.state === "half-open" || circuit.failures >= FAILURE_THRESHOLD) {
    const previousState = circuit.state;
    circuit.state = "open";
    circuit.openedAt = Date.now();
    metrics.recordCircuitOpen();
    console.error(
      `[AI] Circuit breaker opened (was ${previousState}, failures: ${circuit.failures})`
    );
  }
}

type GenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  reasoning?: "none" | "default";
  /** Per-call timeout in ms. Defaults to 15s for user-facing requests. Seed/background jobs pass a longer value. */
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq(
  prompt: string,
  options: Required<GenerateOptions>,
  attempt: number
): Promise<string> {
  // Circuit breaker check
  if (circuitIsOpen()) {
    throw new Error("AI provider circuit breaker is open — provider unavailable");
  }

  const startTime = Date.now();

  const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.groqQwenModel,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      thinking: { type: "disabled" }
    }),
    signal: AbortSignal.timeout(options.timeoutMs)
  });

  if (response.status === 429 && attempt < MAX_429_RETRIES) {
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    const backoffMs = Math.max(retryAfter * 1000, 2000 * (attempt + 1));
    await sleep(backoffMs);
    metrics.recordAiRetry();
    return callGroq(prompt, options, attempt + 1);
  }

  if (!response.ok) {
    recordFailure();
    metrics.recordAiFailure();
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as unknown;

  // Validate the AI response structure before using it
  if (!data || typeof data !== "object") {
    recordFailure();
    metrics.recordAiFailure();
    throw new Error("AI response is not a valid object");
  }

  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    recordFailure();
    metrics.recordAiFailure();
    throw new Error("AI response has no choices");
  }

  const message = (choices[0] as { message?: { content?: unknown; reasoning?: unknown } })?.message;
  const content = message?.content;
  // Fallback: some reasoning models (e.g. mimo-v2.5) may put output in `reasoning` when content is null
  const raw = (typeof content === "string" && content.length > 0)
    ? content
    : (typeof message?.reasoning === "string" && message.reasoning.length > 0)
      ? message.reasoning
      : null;
  if (!raw) {
    recordFailure();
    metrics.recordAiFailure();
    throw new Error("AI response content is not a string");
  }

  const latencyMs = Date.now() - startTime;
  metrics.recordAiCall(latencyMs);
  recordSuccess();

  return stripThinkingTags(raw);
}

/** §15.1: AI timeout wrapper — default 30s for user-facing calls. Seed scripts pass a longer timeout. */
const DEFAULT_AI_TIMEOUT_MS = 30_000;

export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const resolved: Required<GenerateOptions> = {
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? 0.7,
    reasoning: options.reasoning ?? "none",
    timeoutMs: options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS
  };

  // §15.1: Wrap the call with a timeout. If the AI provider does not
  // respond within the ceiling, record a latency violation and fail fast so
  // the caller can fall back to deterministic logic.
  let timeoutId: NodeJS.Timeout | undefined;
  const callPromise = callGroq(prompt, resolved, 0);

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      metrics.recordLatencyViolation("ai:generateText");
      reject(new Error(`AI request timed out after ${resolved.timeoutMs / 1000} seconds (§15.1 latency ceiling)`));
    }, resolved.timeoutMs);
  });

  try {
    return await Promise.race([callPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Returns the current circuit breaker state for health/metrics reporting.
 */
export function getCircuitBreakerState() {
  return {
    state: circuit.state,
    consecutiveFailures: circuit.failures,
    failureThreshold: FAILURE_THRESHOLD,
    resetTimeoutMs: RESET_TIMEOUT_MS,
    openedAt: circuit.state === "open" ? new Date(circuit.openedAt).toISOString() : null,
  };
}
