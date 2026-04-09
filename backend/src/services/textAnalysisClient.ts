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
  "Do not include markdown.",
  "When GPS coordinates are provided, you MUST verify that the location name mentioned in the report text matches those coordinates. Use your geographic knowledge to check: if the text says 'Mirpur' the coordinates must be in Mirpur (~23.81, ~90.41), not in Rayerbazar (~23.74, ~90.39). If the text says 'Sylhet' the coordinates must be near Sylhet (~24.89, ~91.87), not Chittagong (~22.34, ~91.83).",
  "LOCATION MISMATCH RULE: If any location name mentioned in the report text (title, description) does NOT match the provided GPS coordinates, you MUST set credibility_score to 0 and spam_flagged to true. This is a deliberate attempt to falsify the report location.",
  "Do not include coordinates in the incident_title."
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

export async function classifyIncidentText(text: string, latitude?: number | null, longitude?: number | null) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Text analysis requires a non-empty description");
  }

  let userContent = normalizedText;
  if (latitude != null && longitude != null) {
    userContent = `Location coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n\n${normalizedText}`;
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
            content: userContent
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
