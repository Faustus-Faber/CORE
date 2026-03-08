import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAuthToken } from "../utils/jwt.js";

const listUnderReviewIncidentReportsMock = vi.fn();
const updateIncidentReportStatusByAdminMock = vi.fn();

vi.mock("../services/reportService.js", () => {
  return {
    listUnderReviewIncidentReports: listUnderReviewIncidentReportsMock,
    updateIncidentReportStatusByAdmin: updateIncidentReportStatusByAdminMock
  };
});

const { app } = await import("../app.js");

function buildToken(role: "USER" | "VOLUNTEER" | "ADMIN") {
  return signAuthToken({ userId: "507f1f77bcf86cd799439011", role }, false);
}

describe("admin report moderation routes", () => {
  beforeEach(() => {
    listUnderReviewIncidentReportsMock.mockReset();
    updateIncidentReportStatusByAdminMock.mockReset();
  });

  it("blocks non-admin users from listing unpublished reports", async () => {
    const response = await request(app)
      .get("/api/admin/reports/unpublished")
      .set("Authorization", `Bearer ${buildToken("USER")}`);

    expect(response.status).toBe(403);
  });

  it("lists unpublished reports for admin", async () => {
    listUnderReviewIncidentReportsMock.mockResolvedValue([
      {
        id: "r11",
        reporterId: "u2",
        reporterName: "Community Member",
        isMine: false,
        incidentTitle: "Suspicious fire alert",
        classifiedIncidentTitle: "Unverified Fire",
        incidentType: "FIRE",
        classifiedIncidentType: "FIRE",
        description: "Smoke seen from far distance",
        locationText: "Dhaka",
        credibilityScore: 22,
        severityLevel: "LOW",
        status: "UNDER_REVIEW",
        spamFlagged: true,
        createdAt: "2026-03-05T12:00:00.000Z"
      }
    ]);

    const response = await request(app)
      .get("/api/admin/reports/unpublished?search=fire&sortBy=severity&order=desc")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(listUnderReviewIncidentReportsMock).toHaveBeenCalledWith({
      search: "fire",
      severity: "ALL",
      sortBy: "severity",
      order: "desc",
      page: 1,
      limit: 8
    });
  });

  it("updates report status for admin", async () => {
    updateIncidentReportStatusByAdminMock.mockResolvedValue({
      id: "r11",
      status: "PUBLISHED",
      spamFlagged: false
    });

    const response = await request(app)
      .patch("/api/admin/reports/r11/status")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`)
      .send({ status: "PUBLISHED" });

    expect(response.status).toBe(200);
    expect(updateIncidentReportStatusByAdminMock).toHaveBeenCalledWith(
      "r11",
      "PUBLISHED"
    );
  });

  it("rejects invalid moderation payload", async () => {
    const response = await request(app)
      .patch("/api/admin/reports/r11/status")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`)
      .send({ status: "ARCHIVED" });

    expect(response.status).toBe(400);
  });
});
