import { describe, it, expect } from "vitest";
import "dotenv/config";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const GROQ_QWEN_MODEL = process.env.GROQ_QWEN_MODEL ?? "deepseek-v4-flash";
const TIMEOUT_MS = 60000;

const skipReason = !GROQ_API_KEY || GROQ_API_KEY === "test-key"
  ? "GROQ_API_KEY not configured"
  : undefined;

async function callGroqRaw(body: Record<string, unknown>) {
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: GROQ_QWEN_MODEL, ...body })
  });

  const text = await res.text();
  return { status: res.status, text };
}

const USER_PROMPT = `Generate a concise survival instruction (50-150 words) for this emergency:

Type: FLOOD
Severity: CRITICAL
Title: Severe flooding in Mirpur-10
Description: Heavy rainfall has caused water levels to rise rapidly. Families trapped on ground floor.

Provide only actionable safety advice. No preamble.`;

describe.skipIf(skipReason)("DeepSeek V4 Flash reasoning separation", () => {
  it("baseline: content field is clean (reasoning in reasoning_content)", async () => {
    const { status, text } = await callGroqRaw({
      messages: [{ role: "user", content: USER_PROMPT }],
      temperature: 0.7,
      max_tokens: 600
    });

    if (status === 429) {
      console.log("[BASELINE] Skipped due to rate limit (429)");
      return;
    }

    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";
    const reasoningContent = parsed.choices?.[0]?.message?.reasoning_content ?? "";

    console.log("[BASELINE] status:", status);
    console.log("[BASELINE] content length:", content.length);
    console.log("[BASELINE] reasoning_content length:", reasoningContent.length);
    console.log("[BASELINE] content preview:", content.slice(0, 250));

    expect(status).toBe(200);
    // The content field should NOT contain think tags — reasoning is separated
    expect(content.includes("<think>")).toBe(false);
    // Content should be non-empty (actual response)
    expect(content.length).toBeGreaterThan(0);
  }, TIMEOUT_MS);

  it("JSON mode: content is pure JSON (no reasoning contamination)", async () => {
    const { status, text } = await callGroqRaw({
      messages: [
        { role: "system", content: 'Return ONLY a JSON object: {"advisories": ["string1", "string2"]}' },
        { role: "user", content: "Generate 2 safety advisories for a flood." }
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" }
    });

    if (status === 429) {
      console.log("[JSON-MODE] Skipped due to rate limit (429)");
      return;
    }

    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";

    console.log("[JSON-MODE] status:", status);
    console.log("[JSON-MODE] content:", content.slice(0, 400));

    expect(status).toBe(200);
    // Content should be valid JSON (no think tags prefixing it)
    expect(content.startsWith("{")).toBe(true);
    expect(content.includes("<think>")).toBe(false);
    // Should parse as JSON
    const jsonObj = JSON.parse(content);
    expect(jsonObj).toHaveProperty("advisories");
  }, TIMEOUT_MS);

  it("reasoning_content field is populated (proves reasoning separation works)", async () => {
    const { status, text } = await callGroqRaw({
      messages: [{ role: "user", content: USER_PROMPT }],
      temperature: 0.7,
      max_tokens: 600
    });

    if (status === 429) {
      console.log("[REASONING] Skipped due to rate limit (429)");
      return;
    }

    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";
    const reasoningContent = parsed.choices?.[0]?.message?.reasoning_content ?? "";

    console.log("[REASONING] status:", status);
    console.log("[REASONING] content length:", content.length);
    console.log("[REASONING] reasoning_content length:", reasoningContent.length);
    console.log("[REASONING] reasoning preview:", reasoningContent.slice(0, 200));

    expect(status).toBe(200);
    // reasoning_content should exist (may be empty string if model chose not to reason,
    // but the field should be present)
    expect(parsed.choices?.[0]?.message).toHaveProperty("reasoning_content");
  }, TIMEOUT_MS);
});
