import { z } from "zod";

import { env } from "../config/env.js";

export type VoiceInputFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

const voiceReportResponseSchema = z.object({
  status: z.string(),
  filename: z.string(),
  detected_language: z.string(),
  language_probability: z.number().nullable(),
  translated_description: z.string()
});

const groqTranscriptionResponseSchema = z
  .object({
    text: z.string(),
    language: z.string().optional()
  })
  .passthrough();

const groqTranslationResponseSchema = z.object({ text: z.string() }).passthrough();

export type VoiceReportResult = z.infer<typeof voiceReportResponseSchema>;

type GroqAudioEndpoint = "/audio/transcriptions" | "/audio/translations";

function bufferToArrayBuffer(file: VoiceInputFile): ArrayBuffer {
  return file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  ) as ArrayBuffer;
}

function buildAudioFormData(file: VoiceInputFile, responseFormat?: "verbose_json") {
  const formData = new FormData();
  formData.append("file", new Blob([bufferToArrayBuffer(file)], { type: file.mimetype }), file.originalname);
  formData.append("model", env.groqWhisperModel);
  if (responseFormat) {
    formData.append("response_format", responseFormat);
  }
  return formData;
}

async function extractErrorMessage(response: Response) {
  const fallback = `Groq request failed with status ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: { message?: string }; message?: string };
    return payload.error?.message ?? payload.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function postGroqAudio(path: GroqAudioEndpoint, body: FormData, signal: AbortSignal) {
  const response = await fetch(`${env.groqBaseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.groqApiKey}` },
    body,
    signal
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
}

function isEnglish(language: string | undefined) {
  if (!language) return false;
  const normalized = language.toLowerCase();
  return normalized === "en" || normalized.startsWith("en-");
}

export async function submitVoiceReport(file: VoiceInputFile): Promise<VoiceReportResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiRequestTimeoutMs);

  try {
    const transcriptionPayload = await postGroqAudio(
      "/audio/transcriptions",
      buildAudioFormData(file, "verbose_json"),
      controller.signal
    );
    const transcription = groqTranscriptionResponseSchema.parse(transcriptionPayload);
    const detectedLanguage = transcription.language ?? "unknown";

    let translatedDescription = transcription.text.trim();

    if (!isEnglish(detectedLanguage)) {
      const translationPayload = await postGroqAudio(
        "/audio/translations",
        buildAudioFormData(file),
        controller.signal
      );
      const translation = groqTranslationResponseSchema.parse(translationPayload);
      if (translation.text.trim()) {
        translatedDescription = translation.text.trim();
      }
    }

    return voiceReportResponseSchema.parse({
      status: "success",
      filename: file.originalname,
      detected_language: detectedLanguage,
      language_probability: null,
      translated_description: translatedDescription
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Groq voice request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
