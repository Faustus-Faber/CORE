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

const groqTranslationResponseSchema = z
  .object({
    text: z.string()
  })
  .passthrough();

export type VoiceReportResult = z.infer<typeof voiceReportResponseSchema>;

function toArrayBuffer(file: VoiceInputFile) {
  return file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  ) as ArrayBuffer;
}

function buildAudioFormData(
  file: VoiceInputFile,
  options: { responseFormat?: "verbose_json" } = {}
) {
  const formData = new FormData();
  const blob = new Blob([toArrayBuffer(file)], { type: file.mimetype });
  formData.append("file", blob, file.originalname);
  formData.append("model", env.groqWhisperModel);

  if (options.responseFormat) {
    formData.append("response_format", options.responseFormat);
  }

  return formData;
}

async function readErrorMessage(response: Response) {
  const fallbackMessage = `Groq request failed with status ${response.status}`;

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

async function postGroqAudio(
  path: "/audio/transcriptions" | "/audio/translations",
  body: FormData,
  signal: AbortSignal
) {
  const response = await fetch(`${env.groqBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`
    },
    body,
    signal
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

function isEnglishLanguage(language: string | undefined) {
  if (!language) {
    return false;
  }

  const normalized = language.toLowerCase();
  return normalized === "en" || normalized.startsWith("en-");
}

export async function submitVoiceReport(file: VoiceInputFile) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, env.aiRequestTimeoutMs);

  try {
    const transcriptionPayload = await postGroqAudio(
      "/audio/transcriptions",
      buildAudioFormData(file, { responseFormat: "verbose_json" }),
      abortController.signal
    );
    const transcription =
      groqTranscriptionResponseSchema.parse(transcriptionPayload);

    let translatedDescription = transcription.text.trim();
    const detectedLanguage = transcription.language ?? "unknown";

    if (!isEnglishLanguage(detectedLanguage)) {
      const translationPayload = await postGroqAudio(
        "/audio/translations",
        buildAudioFormData(file),
        abortController.signal
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
