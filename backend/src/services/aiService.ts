import { env } from "../config/env.js";
import { stripThinkingTags } from "../utils/sanitize.js";

const DEFAULT_MAX_TOKENS = 800;
const MAX_429_RETRIES = 2;

type GenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  reasoning?: "none" | "default";
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq(
  prompt: string,
  options: Required<GenerateOptions>,
  attempt: number
): Promise<string> {
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
      reasoning_effort: options.reasoning
    }),
    signal: AbortSignal.timeout(env.aiRequestTimeoutMs)
  });

  if (response.status === 429 && attempt < MAX_429_RETRIES) {
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    const backoffMs = Math.max(retryAfter * 1000, 2000 * (attempt + 1));
    await sleep(backoffMs);
    return callGroq(prompt, options, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices[0]?.message.content ?? "";
  return stripThinkingTags(raw);
}

export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const resolved: Required<GenerateOptions> = {
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? 0.7,
    reasoning: options.reasoning ?? "none"
  };
  return callGroq(prompt, resolved, 0);
}
