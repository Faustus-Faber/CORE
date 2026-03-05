import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("GROQ_BASE_URL", "https://api.groq.com/openai/v1");
    vi.stubEnv("GROQ_WHISPER_MODEL", "whisper-large-v3");
    vi.stubEnv("GROQ_QWEN_MODEL", "qwen/qwen3-32b");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("submits voice audio to Groq transcriptions endpoint with auth + model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        text: "Flood water rising quickly.",
        language: "en"
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const file = {
      buffer: Buffer.from("voice-bytes"),
      originalname: "voice.webm",
      mimetype: "audio/webm"
    } as Express.Multer.File;

    const output = await submitVoiceReport(file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    const options = request?.[1] as {
      body?: FormData;
      headers?: Record<string, string>;
      method?: string;
    };

    expect(options.method).toBe("POST");
    expect(options.headers?.Authorization).toMatch(/^Bearer\s+\S+/);
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body?.get("file")).toBeTruthy();
    expect(options.body?.get("model")).toBe("whisper-large-v3");
    expect(options.body?.get("response_format")).toBe("verbose_json");

    expect(output).toEqual({
      status: "success",
      filename: "voice.webm",
      detected_language: "en",
      language_probability: null,
      translated_description: "Flood water rising quickly."
    } satisfies VoiceReportResult);
  });

  it("calls Groq translation endpoint when detected language is non-English", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          text: "বাজারের কাছে আগুন লেগেছে",
          language: "bn"
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          text: "A fire has broken out near the market."
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const file = {
      buffer: Buffer.from("voice-bytes"),
      originalname: "voice.webm",
      mimetype: "audio/webm"
    } as Express.Multer.File;

    const output = await submitVoiceReport(file);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.groq.com/openai/v1/audio/translations"
    );
    expect(output.translated_description).toBe(
      "A fire has broken out near the market."
    );
    expect(output.detected_language).toBe("bn");
  });

  it("sends text classification request to Groq chat completions with Qwen model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                credibility_score: 78,
                severity_level: "HIGH",
                incident_type: "FLOOD",
                incident_title: "Flash flood near market",
                spam_flagged: false
              } satisfies TextAnalysisResult)
            }
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const output = await classifyIncidentText("Flash flood near market.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("https://api.groq.com/openai/v1/chat/completions");

    const options = request?.[1] as {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };

    expect(options.method).toBe("POST");
    expect(options.headers?.["Content-Type"]).toBe("application/json");
    expect(options.headers?.Authorization).toMatch(/^Bearer\s+\S+/);
    expect(options.body).toContain("\"model\":\"qwen/qwen3-32b\"");

    expect(output).toEqual({
      credibility_score: 78,
      severity_level: "HIGH",
      incident_type: "FLOOD",
      incident_title: "Flash flood near market",
      spam_flagged: false
    } satisfies TextAnalysisResult);
  });
});
