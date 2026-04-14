import { env } from "../config/env.js";

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

  return data.choices[0]?.message.content ?? "";
}
