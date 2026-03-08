import { z } from "zod";

import { env } from "../config/env.js";

const textAnalysisResultSchema = z.object({
  credibility_score: z.number(),
  severity_level: z.string(),
  incident_type: z.string(),
  incident_title: z.string(),
  spam_flagged: z.boolean()
});

export type TextAnalysisResult = z.infer<typeof textAnalysisResultSchema>;

const groqChatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().min(1)
        })
      })
    )
    .min(1)
});

const classifierSystemPrompt = [
  "You are an emergency incident classification engine.",
  "Classify the report text and return JSON only.",
  "Required JSON keys: credibility_score (0-100 number), severity_level (CRITICAL|HIGH|MEDIUM|LOW), incident_type (FLOOD|FIRE|EARTHQUAKE|BUILDING_COLLAPSE|ROAD_ACCIDENT|VIOLENCE|MEDICAL_EMERGENCY|OTHER), incident_title (short string), spam_flagged (boolean).",
  "Do not include markdown."
].join(" ");

async function readErrorMessage(response: Response) {
  const fallbackMessage = `Groq text classification request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    return payload.error?.message ?? payload.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function classifyIncidentText(text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Text analysis requires a non-empty description");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, env.aiRequestTimeoutMs);

  try {
    const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqQwenModel,
        temperature: 0,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content: classifierSystemPrompt
          },
          {
            role: "user",
            content: normalizedText
          }
        ]
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const payload = groqChatCompletionSchema.parse(await response.json());
    const content = payload.choices[0]?.message.content ?? "";
    let decoded: unknown;

    try {
      decoded = JSON.parse(content);
    } catch {
      throw new Error("Groq classification response was not valid JSON");
    }

    return textAnalysisResultSchema.parse(decoded);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Groq text classification request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
