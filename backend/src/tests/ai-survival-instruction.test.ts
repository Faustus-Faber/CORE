import { describe, it, expect } from "vitest";
import "dotenv/config";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_QWEN_MODEL = process.env.GROQ_QWEN_MODEL ?? "qwen/qwen3-32b";
const TIMEOUT_MS = 30000;

const skipReason = !GROQ_API_KEY || GROQ_API_KEY === "test-groq-key"
  ? "GROQ_API_KEY not configured — set it in .env to run live AI tests"
  : undefined;

type GroqResult = {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  parsed: { choices?: Array<{ message: { content: string } }> } | null;
};

async function rawGroqCall(prompt: string): Promise<GroqResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_QWEN_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096
      }),
      signal: controller.signal
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });

    const bodyText = await res.text();
    let parsed: GroqResult["parsed"] = null;
    try { parsed = JSON.parse(bodyText); } catch { /* non-JSON error body */ }

    return { status: res.status, headers, bodyText, parsed };
  } finally {
    clearTimeout(timer);
  }
}

function buildSurvivalPrompt(
  incidentType: string,
  severity: string,
  title: string,
  description: string
): string {
  return `Generate a concise survival instruction (50-150 words) for this emergency:

Type: ${incidentType}
Severity: ${severity}
Title: ${title}
Description: ${description.slice(0, 300)}

Provide only actionable safety advice. No preamble.`;
}

describe.skipIf(skipReason)("AI Prompt: Survival Instruction (live)", () => {
  it("returns a usable safety instruction for a FLOOD alert", async () => {
    const prompt = buildSurvivalPrompt(
      "FLOOD",
      "CRITICAL",
      "Severe flooding in Mirpur-10",
      "Heavy rainfall has caused water levels to rise rapidly. Families trapped on ground floor. Streets submerged."
    );

    const result = await rawGroqCall(prompt);

    console.log("[FLOOD] status=", result.status);
    console.log("[FLOOD] rate-limit headers:", {
      remainingRequests: result.headers["x-ratelimit-remaining-requests"],
      remainingTokens: result.headers["x-ratelimit-remaining-tokens"],
      retryAfter: result.headers["retry-after"]
    });

    if (result.status !== 200) {
      console.log("[FLOOD] error body:", result.bodyText.slice(0, 500));
    }

    expect(result.status, `Groq returned ${result.status}: ${result.bodyText.slice(0, 200)}`).toBe(200);

    const content = result.parsed?.choices?.[0]?.message?.content ?? "";
    console.log("[FLOOD] raw content length:", content.length);
    console.log("[FLOOD] first 400 chars:", content.slice(0, 400));

    expect(content.length).toBeGreaterThan(20);
  }, TIMEOUT_MS);

  it("returns content that survives stripThinkingTags post-processing", async () => {
    const { stripThinkingTags } = await import("../utils/sanitize.js");

    const prompt = buildSurvivalPrompt(
      "FIRE",
      "HIGH",
      "Garment factory fire in Dhanmondi",
      "Multiple floors engulfed in flames. 15 workers reported trapped. Thick black smoke visible."
    );

    const result = await rawGroqCall(prompt);

    expect(result.status, `Groq returned ${result.status}: ${result.bodyText.slice(0, 200)}`).toBe(200);

    const raw = result.parsed?.choices?.[0]?.message?.content ?? "";
    const stripped = stripThinkingTags(raw);

    console.log("[FIRE] raw length:", raw.length, "stripped length:", stripped.length);
    console.log("[FIRE] raw preview:", raw.slice(0, 300));
    console.log("[FIRE] stripped preview:", stripped.slice(0, 300));

    expect(raw.length).toBeGreaterThan(20);
    expect(stripped.length).toBeGreaterThan(20);
  }, TIMEOUT_MS);

  it("reports current rate-limit budget", async () => {
    const probe = await rawGroqCall("Reply with the single word: OK");

    console.log("[PROBE] status:", probe.status);
    console.log("[PROBE] headers:", probe.headers);
    console.log("[PROBE] body (first 300 chars):", probe.bodyText.slice(0, 300));

    expect([200, 429]).toContain(probe.status);
  }, TIMEOUT_MS);
});
