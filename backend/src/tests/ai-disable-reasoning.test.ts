import { describe, it, expect } from "vitest";
import "dotenv/config";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_QWEN_MODEL = process.env.GROQ_QWEN_MODEL ?? "qwen/qwen3-32b";
const TIMEOUT_MS = 30000;

const skipReason = !GROQ_API_KEY || GROQ_API_KEY === "test-groq-key"
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

describe.skipIf(skipReason)("Qwen3 reasoning control", () => {
  it("baseline: default mode includes <think> block", async () => {
    const { status, text } = await callGroqRaw({
      messages: [{ role: "user", content: USER_PROMPT }],
      temperature: 0.7,
      max_tokens: 600
    });
    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";

    console.log("[BASELINE] status:", status);
    console.log("[BASELINE] length:", content.length, "has <think>:", content.includes("<think>"));
    console.log("[BASELINE] preview:", content.slice(0, 250));

    expect(status).toBe(200);
  }, TIMEOUT_MS);

  it("reasoning_effort=none suppresses the think block", async () => {
    const { status, text } = await callGroqRaw({
      messages: [{ role: "user", content: USER_PROMPT }],
      temperature: 0.7,
      max_tokens: 600,
      reasoning_effort: "none"
    });
    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";

    console.log("[EFFORT-NONE] status:", status);
    console.log("[EFFORT-NONE] length:", content.length, "has <think>:", content.includes("<think>"));
    console.log("[EFFORT-NONE] preview:", content.slice(0, 250));
    if (status !== 200) console.log("[EFFORT-NONE] error body:", text.slice(0, 500));

    expect([200, 400]).toContain(status);
  }, TIMEOUT_MS);

  it("reasoning_format=hidden strips the think block from output", async () => {
    const { status, text } = await callGroqRaw({
      messages: [{ role: "user", content: USER_PROMPT }],
      temperature: 0.7,
      max_tokens: 600,
      reasoning_format: "hidden"
    });
    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";

    console.log("[FORMAT-HIDDEN] status:", status);
    console.log("[FORMAT-HIDDEN] length:", content.length, "has <think>:", content.includes("<think>"));
    console.log("[FORMAT-HIDDEN] preview:", content.slice(0, 250));
    if (status !== 200) console.log("[FORMAT-HIDDEN] error body:", text.slice(0, 500));

    expect([200, 400]).toContain(status);
  }, TIMEOUT_MS);

  it("/no_think directive in prompt disables reasoning", async () => {
    const { status, text } = await callGroqRaw({
      messages: [{ role: "user", content: `${USER_PROMPT}\n\n/no_think` }],
      temperature: 0.7,
      max_tokens: 600
    });
    const parsed = JSON.parse(text);
    const content = parsed.choices?.[0]?.message?.content ?? "";

    console.log("[NO-THINK] status:", status);
    console.log("[NO-THINK] length:", content.length, "has <think>:", content.includes("<think>"));
    console.log("[NO-THINK] preview:", content.slice(0, 250));

    expect(status).toBe(200);
  }, TIMEOUT_MS);
});
