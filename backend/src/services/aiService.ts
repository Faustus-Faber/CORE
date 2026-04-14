import { env } from "../config/env.js";

const OPEN_TAG = "<" + "think" + "ing>";
const CLOSE_TAG = "</" + "think" + "ing>";
const OPEN_TAG_SHORT = "<" + "think" + ">";
const CLOSE_TAG_SHORT = "</" + "think" + ">";

export async function generateText(prompt: string): Promise<string> {
  const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.groqQwenModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    }),
    signal: AbortSignal.timeout(env.aiRequestTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices[0]?.message.content ?? "";
  return stripThinkingTags(raw).trim();
}

function stripThinkingTags(text: string): string {
  let result = text;

  const startIdx = result.indexOf(OPEN_TAG);
  if (startIdx !== -1) {
    let closeIdx = result.indexOf(CLOSE_TAG, startIdx + OPEN_TAG.length);
    if (closeIdx === -1) {
      closeIdx = result.indexOf(CLOSE_TAG_SHORT, startIdx + OPEN_TAG.length);
    }
    if (closeIdx !== -1) {
      const endLen = closeIdx !== -1 && result.startsWith(CLOSE_TAG, closeIdx)
        ? CLOSE_TAG.length
        : CLOSE_TAG_SHORT.length;
      result = result.slice(0, startIdx) + result.slice(closeIdx + endLen);
    } else {
      result = result.slice(0, startIdx);
    }
  }

  const startIdx2 = result.indexOf(OPEN_TAG_SHORT);
  if (startIdx2 !== -1) {
    let closeIdx2 = result.indexOf(CLOSE_TAG_SHORT, startIdx2 + OPEN_TAG_SHORT.length);
    if (closeIdx2 === -1) {
      closeIdx2 = result.indexOf(CLOSE_TAG, startIdx2 + OPEN_TAG_SHORT.length);
    }
    if (closeIdx2 !== -1) {
      const endLen = result.startsWith(CLOSE_TAG, closeIdx2)
        ? CLOSE_TAG.length
        : CLOSE_TAG_SHORT.length;
      result = result.slice(0, startIdx2) + result.slice(closeIdx2 + endLen);
    } else {
      result = result.slice(0, startIdx2);
    }
  }

  return result.trim();
}
