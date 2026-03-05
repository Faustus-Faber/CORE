import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyIncidentText,
  type TextAnalysisResult
} from "../services/textAnalysisClient.js";
import {
  submitVoiceReport,
  type VoiceReportResult
} from "../services/voiceReportClient.js";

function mockJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("external API clients", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("submits voice audio as multipart form-data with audio_file key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        status: "success",
        filename: "voice.webm",
        detected_language: "bn",
        language_probability: 0.91,
        translated_description: "Flood water rising quickly."
      } satisfies VoiceReportResult)
    );

    vi.stubGlobal("fetch", fetchMock);

    const file = {
      buffer: Buffer.from("voice-bytes"),
      originalname: "voice.webm",
      mimetype: "audio/webm"
    } as Express.Multer.File;

    await submitVoiceReport(file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0];
    const options = request?.[1] as { body?: FormData; method?: string };

    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body?.get("audio_file")).toBeTruthy();
  });

  it("sends text analysis payload with classification task", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        credibility_score: 78,
        severity_level: "HIGH",
        incident_type: "FLOOD",
        incident_title: "Flash flood near market",
        spam_flagged: false
      } satisfies TextAnalysisResult)
    );

    vi.stubGlobal("fetch", fetchMock);

    await classifyIncidentText("Flash flood near market.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0]?.[1] as {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };
    expect(options.method).toBe("POST");
    expect(options.headers?.["Content-Type"]).toBe("application/json");
    expect(options.body).toContain("\"task\":\"classification\"");
  });
});
