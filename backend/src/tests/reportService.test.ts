import { describe, expect, it, vi } from "vitest";

import {
  createIncidentReport,
  listIncidentReports,
  listUnderReviewIncidentReports
} from "../services/reportService.js";

describe("createIncidentReport", () => {
  it("uses voice translation for classification when voice note is present", async () => {
    const submitVoiceReport = vi.fn().mockResolvedValue({
      status: "success",
      filename: "voice.webm",
      detected_language: "bn",
      language_probability: 0.94,
      translated_description: "Severe flood near the north market."
    });
    const classifyIncidentText = vi.fn().mockResolvedValue({
      credibility_score: 75,
      severity_level: "HIGH",
      incident_type: "FLOOD",
      incident_title: "Flood at North Market",
      spam_flagged: false
    });
    const createReportRecord = vi.fn().mockResolvedValue({ id: "r1" });

    const output = await createIncidentReport(
      {
        reporterId: "507f1f77bcf86cd799439011",
        incidentTitle: "Initial title",
        description: "",
        incidentType: "FLOOD",
        locationText: "Dhaka",
        mediaFiles: [],
        voiceFile: {
          buffer: Buffer.from("voice"),
          originalname: "voice.webm",
          mimetype: "audio/webm",
          size: 1300
        }
      },
      {
        submitVoiceReport,
        classifyIncidentText,
        createReportRecord
      }
    );

    expect(submitVoiceReport).toHaveBeenCalledOnce();
    expect(classifyIncidentText).toHaveBeenCalledWith(
      "Severe flood near the north market."
    );
    expect(output.spamFlagged).toBe(false);
  });

  it("skips voice API call when no voice note is provided", async () => {
    const submitVoiceReport = vi.fn();
    const classifyIncidentText = vi.fn().mockResolvedValue({
      credibility_score: 61,
      severity_level: "MEDIUM",
      incident_type: "OTHER",
      incident_title: "Generic incident",
      spam_flagged: false
    });
    const createReportRecord = vi.fn().mockResolvedValue({ id: "r2" });

    await createIncidentReport(
      {
        reporterId: "507f1f77bcf86cd799439011",
        incidentTitle: "Help needed",
        description: "Power lines have fallen near school.",
        incidentType: "OTHER",
        locationText: "Dhaka",
        mediaFiles: []
      },
      {
        submitVoiceReport,
        classifyIncidentText,
        createReportRecord
      }
    );

    expect(submitVoiceReport).not.toHaveBeenCalled();
    expect(classifyIncidentText).toHaveBeenCalledWith(
      "Power lines have fallen near school."
    );
  });

  it("marks report as spam if score below threshold", async () => {
    const classifyIncidentText = vi.fn().mockResolvedValue({
      credibility_score: 22,
      severity_level: "LOW",
      incident_type: "OTHER",
      incident_title: "Noise report",
      spam_flagged: false
    });
    const createReportRecord = vi.fn().mockResolvedValue({ id: "r3" });

    const output = await createIncidentReport(
      {
        reporterId: "507f1f77bcf86cd799439011",
        incidentTitle: "Random",
        description: "Unverified noise near market.",
        incidentType: "OTHER",
        locationText: "Dhaka",
        mediaFiles: []
      },
      {
        submitVoiceReport: vi.fn(),
        classifyIncidentText,
        createReportRecord
      }
    );

    expect(output.spamFlagged).toBe(true);
    expect(output.status).toBe("UNDER_REVIEW");
  });
});

describe("listIncidentReports", () => {
  const sampleReports = [
    {
      id: "r1",
      reporterId: "u1",
      incidentTitle: "Flood near station",
      description: "water rising",
      incidentType: "FLOOD",
      locationText: "North District",
      mediaFilenames: [],
      sourceAudioFilename: null,
      detectedLanguage: null,
      languageProbability: null,
      translatedDescription: null,
      credibilityScore: 80,
      severityLevel: "HIGH",
      classifiedIncidentType: "FLOOD",
      classifiedIncidentTitle: "Station Flood Alert",
      spamFlagged: false,
      status: "PUBLISHED",
      createdAt: new Date("2026-03-05T09:00:00.000Z"),
      updatedAt: new Date("2026-03-05T09:00:00.000Z")
    },
    {
      id: "r2",
      reporterId: "u2",
      incidentTitle: "Fire in market",
      description: "heavy smoke",
      incidentType: "FIRE",
      locationText: "South Point",
      mediaFilenames: [],
      sourceAudioFilename: null,
      detectedLanguage: null,
      languageProbability: null,
      translatedDescription: null,
      credibilityScore: 64,
      severityLevel: "CRITICAL",
      classifiedIncidentType: "FIRE",
      classifiedIncidentTitle: "Major Market Fire",
      spamFlagged: false,
      status: "PUBLISHED",
      createdAt: new Date("2026-03-05T10:00:00.000Z"),
      updatedAt: new Date("2026-03-05T10:00:00.000Z")
    },
    {
      id: "r3",
      reporterId: "u1",
      incidentTitle: "Suspicious spam",
      description: "unknown",
      incidentType: "OTHER",
      locationText: "North District",
      mediaFilenames: [],
      sourceAudioFilename: null,
      detectedLanguage: null,
      languageProbability: null,
      translatedDescription: null,
      credibilityScore: 12,
      severityLevel: "LOW",
      classifiedIncidentType: "OTHER",
      classifiedIncidentTitle: "Unverified post",
      spamFlagged: true,
      status: "UNDER_REVIEW",
      createdAt: new Date("2026-03-05T11:00:00.000Z"),
      updatedAt: new Date("2026-03-05T11:00:00.000Z")
    }
  ];

  const listReports = vi.fn().mockResolvedValue(sampleReports);
  const listUsers = vi.fn().mockResolvedValue([
    { id: "u1", fullName: "Alice Rahman" },
    { id: "u2", fullName: "Rafi Alam" }
  ]);

  it("returns community feed excluding spam and supports search", async () => {
    const reports = await listIncidentReports(
      {
        viewerId: "u1",
        scope: "community",
        search: "market",
        severity: "ALL",
        sortBy: "createdAt",
        order: "desc"
      },
      {
        listReports,
        listUsers
      }
    );

    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe("r2");
    expect(reports[0].reporterName).toBe("Rafi Alam");
    expect(reports[0].isMine).toBe(false);
  });

  it("returns reporter submissions and sorts by severity", async () => {
    const reports = await listIncidentReports(
      {
        viewerId: "u1",
        scope: "mine",
        search: "",
        severity: "ALL",
        sortBy: "severity",
        order: "desc"
      },
      {
        listReports,
        listUsers
      }
    );

    expect(reports).toHaveLength(2);
    expect(reports[0].severityLevel).toBe("HIGH");
    expect(reports[1].severityLevel).toBe("LOW");
    expect(reports[1].status).toBe("UNDER_REVIEW");
    expect(reports[0].isMine).toBe(true);
  });
});

describe("listUnderReviewIncidentReports", () => {
  it("returns only under-review reports with search and sorting", async () => {
    const listReports = vi.fn().mockResolvedValue([
      {
        id: "r1",
        reporterId: "u1",
        incidentTitle: "Flood update",
        description: "water surge",
        incidentType: "FLOOD",
        locationText: "North District",
        mediaFilenames: [],
        sourceAudioFilename: null,
        detectedLanguage: null,
        languageProbability: null,
        translatedDescription: null,
        credibilityScore: 22,
        severityLevel: "LOW",
        classifiedIncidentType: "FLOOD",
        classifiedIncidentTitle: "Unverified flood",
        spamFlagged: true,
        status: "UNDER_REVIEW",
        createdAt: new Date("2026-03-05T11:00:00.000Z"),
        updatedAt: new Date("2026-03-05T11:00:00.000Z")
      },
      {
        id: "r2",
        reporterId: "u2",
        incidentTitle: "Fire alert",
        description: "large fire",
        incidentType: "FIRE",
        locationText: "South Point",
        mediaFilenames: [],
        sourceAudioFilename: null,
        detectedLanguage: null,
        languageProbability: null,
        translatedDescription: null,
        credibilityScore: 18,
        severityLevel: "HIGH",
        classifiedIncidentType: "FIRE",
        classifiedIncidentTitle: "Unverified market fire",
        spamFlagged: true,
        status: "UNDER_REVIEW",
        createdAt: new Date("2026-03-05T12:00:00.000Z"),
        updatedAt: new Date("2026-03-05T12:00:00.000Z")
      }
    ]);
    const listUsers = vi
      .fn()
      .mockResolvedValue([{ id: "u2", fullName: "Rafi Alam" }]);

    const reports = await listUnderReviewIncidentReports(
      {
        search: "fire",
        severity: "ALL",
        sortBy: "createdAt",
        order: "desc"
      },
      {
        listReports,
        listUsers
      }
    );

    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe("r2");
    expect(reports[0].reporterName).toBe("Rafi Alam");
    expect(reports[0].status).toBe("UNDER_REVIEW");
  });
});
