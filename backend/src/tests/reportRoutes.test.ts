import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAuthToken } from "../utils/jwt.js";

const createIncidentReportMock = vi.fn();
const listIncidentReportsMock = vi.fn();

vi.mock("../services/reportService.js", () => {
  return {
    createIncidentReport: createIncidentReportMock,
    listIncidentReports: listIncidentReportsMock
  };
});

const { app } = await import("../app.js");
const uploadsDirectory = resolve(process.cwd(), "uploads", "reports");

function buildAuthToken() {
  return signAuthToken(
    { userId: "507f1f77bcf86cd799439011", role: "USER" },
    false
  );
}

describe("report routes", () => {
  beforeEach(() => {
    createIncidentReportMock.mockReset();
    listIncidentReportsMock.mockReset();
    if (existsSync(uploadsDirectory)) {
      rmSync(uploadsDirectory, { recursive: true, force: true });
    }
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await request(app).post("/api/reports").field({
      incidentTitle: "Flood near bridge",
      description: "Water level rising fast.",
      incidentType: "FLOOD",
      locationText: "Dhaka"
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid report payload", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${buildAuthToken()}`)
      .field({
        incidentTitle: "",
        description: " ",
        incidentType: "FLOOD",
        locationText: ""
      });

    expect(response.status).toBe(400);
  });

  it("returns 201 for valid report payload", async () => {
    createIncidentReportMock.mockResolvedValue({
      id: "r100",
      incidentTitle: "Flood near bridge",
      classifiedIncidentTitle: "Flash flood alert",
      severityLevel: "HIGH",
      credibilityScore: 76,
      classifiedIncidentType: "FLOOD",
      spamFlagged: false,
      status: "PUBLISHED",
      translatedDescription: null
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${buildAuthToken()}`)
      .field({
        incidentTitle: "Flood near bridge",
        description: "Water level rising fast.",
        incidentType: "FLOOD",
        locationText: "Dhaka"
      });

    expect(response.status).toBe(201);
    expect(response.body.report.id).toBe("r100");
    expect(createIncidentReportMock).toHaveBeenCalledOnce();
  });

  it("stores media uploads and forwards stored media paths", async () => {
    createIncidentReportMock.mockResolvedValue({
      id: "r101",
      incidentTitle: "Flood near bridge",
      classifiedIncidentTitle: "Flash flood alert",
      severityLevel: "HIGH",
      credibilityScore: 76,
      classifiedIncidentType: "FLOOD",
      spamFlagged: false,
      status: "PUBLISHED",
      translatedDescription: null
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${buildAuthToken()}`)
      .field({
        incidentTitle: "Flood near bridge",
        description: "Water level rising fast.",
        incidentType: "FLOOD",
        locationText: "Dhaka"
      })
      .attach("media", Buffer.from("fake-image"), "evidence.jpg");

    expect(response.status).toBe(201);
    expect(createIncidentReportMock).toHaveBeenCalledOnce();

    const payload = createIncidentReportMock.mock.calls[0]?.[0] as {
      mediaFiles: Array<{ originalname: string }>;
    };
    expect(payload.mediaFiles).toHaveLength(1);
    expect(payload.mediaFiles[0].originalname).toMatch(
      /^\/uploads\/reports\/.+\.jpg$/i
    );

    const savedFilePath = resolve(
      process.cwd(),
      payload.mediaFiles[0].originalname.replace(/^\//, "")
    );
    expect(existsSync(savedFilePath)).toBe(true);
  });

  it("lists community reports for authenticated users", async () => {
    listIncidentReportsMock.mockResolvedValue([
      {
        id: "r100",
        incidentTitle: "Flood near bridge",
        classifiedIncidentTitle: "Flash flood alert",
        locationText: "Dhaka",
        credibilityScore: 76,
        severityLevel: "HIGH",
        status: "PUBLISHED",
        reporterName: "Test Reporter",
        isMine: false,
        createdAt: "2026-03-05T12:00:00.000Z"
      }
    ]);

    const response = await request(app)
      .get("/api/reports?search=flood&sortBy=severity&order=desc")
      .set("Authorization", `Bearer ${buildAuthToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0].id).toBe("r100");
    expect(listIncidentReportsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "community",
        search: "flood",
        sortBy: "severity"
      })
    );
  });

  it("returns 400 for invalid list query parameters", async () => {
    const response = await request(app)
      .get("/api/reports?sortBy=unsupported")
      .set("Authorization", `Bearer ${buildAuthToken()}`);

    expect(response.status).toBe(400);
  });

  it("lists current user submissions from /mine", async () => {
    listIncidentReportsMock.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/reports/mine?severity=HIGH")
      .set("Authorization", `Bearer ${buildAuthToken()}`);

    expect(response.status).toBe(200);
    expect(listIncidentReportsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "mine",
        severity: "HIGH"
      })
    );
  });
});
