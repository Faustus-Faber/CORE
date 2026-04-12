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
    .array(z.object({ message: z.object({ content: z.string().min(1) }) }))
    .min(1)
});

const classifierSystemPrompt = [
  "You are an emergency incident classification engine for a crisis response platform in Bangladesh.",
  "",
  "Analyze the user-submitted report below and return ONLY a JSON object with these exact keys:",
  "",
  '  "credibility_score": integer 0-100 — how credible/genuine this report is.',
  '  "severity_level": one of "CRITICAL", "HIGH", "MEDIUM", "LOW".',
  '  "incident_type": one of "FLOOD", "FIRE", "EARTHQUAKE", "BUILDING_COLLAPSE", "ROAD_ACCIDENT", "VIOLENCE", "MEDICAL_EMERGENCY", "OTHER".',
  '  "incident_title": a concise 5-12 word title summarizing the incident. Never include GPS coordinates in this title.',
  '  "spam_flagged": boolean — true only if the report is spam, nonsense, a test, or contains a deliberate location mismatch.',
  "",
  "Severity guidelines:",
  '  CRITICAL — immediate life threat, mass casualties, large-scale destruction, or rapidly worsening situation.',
  '  HIGH — significant danger to people or property, injuries reported, urgent response needed.',
  '  MEDIUM — localized damage or disruption, no immediate life threat but needs attention.',
  '  LOW — minor incident, informational, or situation is already under control.',
  "",
  "Credibility rules:",
  "  80-100: specific location, clear description, consistent details, matches known crisis patterns.",
  "  50-79: some details present but vague, or unverifiable.",
  "  20-49: very vague, inconsistent, or suspicious but not clearly fake.",
  "  0-19: clearly spam, nonsense, test message, or deliberate fraud.",
  "",
  "GPS location mismatch detection:",
  "  When GPS coordinates are provided alongside the report text, verify that any location names mentioned in the text are geographically consistent with those coordinates.",
  "  Use your knowledge of Bangladesh geography (Dhaka districts: Mirpur ~23.81/90.37, Dhanmondi ~23.74/90.38, Uttara ~23.87/90.40, Gulshan ~23.79/90.42, Motijheel ~23.73/90.42; divisional cities: Chittagong ~22.34/91.83, Sylhet ~24.89/91.87, Rajshahi ~24.37/88.60, Khulna ~22.82/89.54).",
  '  If the text names a specific location that is more than 15km away from the provided GPS coordinates, set credibility_score to 0 and spam_flagged to true.',
  "",
  "Return raw JSON only. No markdown fences, no explanation, no extra keys."
].join("\n");

async function extractErrorMessage(response: Response) {
  const fallback = `Groq text classification request failed with status ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: { message?: string }; message?: string };
    return payload.error?.message ?? payload.message ?? fallback;
  } catch {
    return fallback;
  }
}

function buildUserContent(text: string, latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) {
    return text;
  }
  return `Location coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n\n${text}`;
}

export async function classifyIncidentText(
  text: string,
  latitude?: number | null,
  longitude?: number | null
): Promise<TextAnalysisResult> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("Text analysis requires a non-empty description");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiRequestTimeoutMs);

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: classifierSystemPrompt },
          { role: "user", content: buildUserContent(normalizedText, latitude, longitude) }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    const payload = groqChatCompletionSchema.parse(await response.json());
    const content = payload.choices[0]?.message.content ?? "";

    try {
      return textAnalysisResultSchema.parse(JSON.parse(content));
    } catch {
      throw new Error("Groq classification response was not valid JSON");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Groq text classification request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
