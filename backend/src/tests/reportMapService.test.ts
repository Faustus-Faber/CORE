import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  crisisEvent: {
    findMany: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock
}));

import { getMapIncidentReports } from "../services/reportService.js";

describe("getMapIncidentReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads active crisis events instead of raw report rows", async () => {
    prismaMock.crisisEvent.findMany.mockResolvedValue([
      {
        id: "crisis-1",
        title: "Flood at Mirpur",
        incidentType: "FLOOD",
        severityLevel: "HIGH",
        locationText: "Mirpur 10",
        sitRepText: "Water levels are rising around the bus stand.",
        latitude: 23.8041,
        longitude: 90.3666,
        createdAt: new Date("2026-04-23T10:00:00.000Z")
      }
    ]);

    const incidents = await getMapIncidentReports("viewer-1");

    expect(prismaMock.crisisEvent.findMany).toHaveBeenCalledWith({
      where: {
        status: {
          notIn: ["RESOLVED", "CLOSED"]
        },
        latitude: { not: null },
        longitude: { not: null }
      },
      select: {
        id: true,
        title: true,
        incidentType: true,
        severityLevel: true,
        locationText: true,
        sitRepText: true,
        latitude: true,
        longitude: true,
        createdAt: true
      }
    });
    expect(incidents[0].id).toBe("crisis-1");
  });
});
