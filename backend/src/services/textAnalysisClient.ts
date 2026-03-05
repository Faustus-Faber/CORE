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
    const response = await fetch(`${env.textAnalysisApiBaseUrl}/api/v1/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: normalizedText,
        task: "classification"
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(
        `Text analysis API request failed with status ${response.status}`
      );
    }

    const payload = await response.json();
    return textAnalysisResultSchema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Text analysis request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
