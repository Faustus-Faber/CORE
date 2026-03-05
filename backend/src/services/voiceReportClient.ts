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
  language_probability: z.number(),
  translated_description: z.string()
});

export type VoiceReportResult = z.infer<typeof voiceReportResponseSchema>;

export async function submitVoiceReport(file: VoiceInputFile) {
  const formData = new FormData();
  const arrayBuffer = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: file.mimetype });
  formData.append("audio_file", blob, file.originalname);

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, env.aiRequestTimeoutMs);

  try {
    const response = await fetch(`${env.voiceApiBaseUrl}/api/v1/voice-report`, {
      method: "POST",
      body: formData,
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`Voice API request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return voiceReportResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Voice API request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
