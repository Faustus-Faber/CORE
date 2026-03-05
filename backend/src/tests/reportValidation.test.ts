import { describe, expect, it } from "vitest";

import {
  validateReportListQueryInput,
  validateReportSubmissionInput
} from "../utils/validation.js";

const basePayload = {
  incidentTitle: "Water rising near bridge",
  description: "Flood water is entering nearby homes.",
  incidentType: "FLOOD",
  locationText: "Dhaka"
};

describe("validateReportSubmissionInput", () => {
  it("accepts valid text-only submission", () => {
    const result = validateReportSubmissionInput({
      ...basePayload,
      mediaFiles: []
    });

    expect(result.incidentType).toBe("FLOOD");
  });

  it("accepts submission with voice note and empty description", () => {
    const result = validateReportSubmissionInput({
      ...basePayload,
      description: "",
      voiceFile: {
        originalname: "note.webm",
        mimetype: "audio/webm",
        size: 1200
      },
      mediaFiles: []
    });

    expect(result.voiceFile?.mimetype).toBe("audio/webm");
  });

  it("rejects when both description and voice are missing", () => {
    expect(() =>
      validateReportSubmissionInput({
        ...basePayload,
        description: "   ",
        mediaFiles: []
      })
    ).toThrow("Description or voice note is required");
  });

  it("rejects unsupported voice mime type", () => {
    expect(() =>
      validateReportSubmissionInput({
        ...basePayload,
        voiceFile: {
          originalname: "note.ogg",
          mimetype: "audio/ogg",
          size: 1200
        },
        mediaFiles: []
      })
    ).toThrow("Voice note format is not supported");
  });
});

describe("validateReportListQueryInput", () => {
  it("applies defaults when query parameters are missing", () => {
    const result = validateReportListQueryInput({});

    expect(result.search).toBe("");
    expect(result.severity).toBe("ALL");
    expect(result.sortBy).toBe("createdAt");
    expect(result.order).toBe("desc");
    expect(result.page).toBe(1);
    expect(result.limit).toBe(8);
  });

  it("accepts explicit search and severity sorting options", () => {
    const result = validateReportListQueryInput({
      search: "north market",
      severity: "HIGH",
      sortBy: "severity",
      order: "asc",
      page: "2",
      limit: "5"
    });

    expect(result.search).toBe("north market");
    expect(result.severity).toBe("HIGH");
    expect(result.sortBy).toBe("severity");
    expect(result.order).toBe("asc");
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });

  it("rejects unsupported sort keys", () => {
    expect(() =>
      validateReportListQueryInput({
        sortBy: "title"
      })
    ).toThrow("Invalid enum value");
  });

  it("rejects unsupported pagination values", () => {
    expect(() =>
      validateReportListQueryInput({
        page: "0",
        limit: "100"
      })
    ).toThrow();
  });
});
