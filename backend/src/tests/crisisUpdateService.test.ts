import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn()
  },
  crisisEvent: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  crisisResponder: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  crisisEventUpdate: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  }
}));

const generateTextMock = vi.hoisted(() => vi.fn());
const dispatchCrisisUpdateNotificationsMock = vi.hoisted(() => vi.fn());
const promptAdminsForNgoReportMock = vi.hoisted(() => vi.fn());
const triggerDispatchAlertsForCrisisMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../services/aiService.js", () => ({
  generateText: generateTextMock
}));

vi.mock("../services/notificationService.js", () => ({
  dispatchCrisisUpdateNotifications: dispatchCrisisUpdateNotificationsMock,
  promptAdminsForNgoReport: promptAdminsForNgoReportMock
}));

vi.mock("../services/dispatchAlertService.js", () => ({
  triggerDispatchAlertsForCrisis: triggerDispatchAlertsForCrisisMock
}));

import {
  getCrisisCommandCenter,
  submitCrisisUpdate
} from "../services/crisisUpdateService.js";

const crisisEventId = "507f1f77bcf86cd799439013";
const volunteerId = "507f1f77bcf86cd799439012";

const eventRecord = {
  id: crisisEventId,
  title: "Ward 7 Flooding",
  incidentType: "FLOOD",
  severityLevel: "HIGH",
  locationText: "Dhaka",
  status: "REPORTED",
  latitude: 23.8103,
  longitude: 90.4125
};

describe("crisisUpdateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (input: any) => {
      if (typeof input === "function") {
        return input({
          crisisEvent: prismaMock.crisisEvent,
          crisisEventUpdate: prismaMock.crisisEventUpdate
        });
      }

      return Promise.all(input);
    });

    prismaMock.user.findUnique.mockResolvedValue({
      role: "VOLUNTEER",
      isBanned: false
    });
    prismaMock.crisisEvent.findUnique.mockResolvedValue(eventRecord);
    prismaMock.crisisEvent.update.mockResolvedValue({});
    prismaMock.crisisEventUpdate.findMany.mockResolvedValue([]);
    prismaMock.crisisResponder.findMany.mockResolvedValue([]);
    generateTextMock.mockResolvedValue("**Flood status updated**\n\nSituation is evolving.\n\n- Responders remain active.");
    dispatchCrisisUpdateNotificationsMock.mockResolvedValue(undefined);
    promptAdminsForNgoReportMock.mockResolvedValue(undefined);
    triggerDispatchAlertsForCrisisMock.mockResolvedValue(undefined);
  });

  it("rejects field intelligence from a volunteer who is not an active responder", async () => {
    prismaMock.crisisResponder.findFirst.mockResolvedValue(null);

    await expect(
      submitCrisisUpdate(crisisEventId, volunteerId, "VOLUNTEER", {
        updateType: "FIELD_OBSERVATION",
        status: "REPORTED",
        updateNote: "Water level is rising near the eastern road."
      })
    ).rejects.toThrow("Opt in to this crisis before publishing field intelligence");

    expect(prismaMock.crisisEventUpdate.create).not.toHaveBeenCalled();
  });

  it("requires a complete closure checklist before resolving a crisis", async () => {
    prismaMock.crisisResponder.findFirst.mockResolvedValue({ id: "responder-1" });

    await expect(
      submitCrisisUpdate(crisisEventId, volunteerId, "VOLUNTEER", {
        updateType: "STATUS_CHANGE",
        status: "RESOLVED",
        updateNote: "Conditions look stable now."
      })
    ).rejects.toThrow(
      "Closure checklist must confirm safety, accountability, and urgent needs"
    );

    expect(prismaMock.crisisEventUpdate.create).not.toHaveBeenCalled();
  });

  it("creates a verified structured update and triggers downstream side effects", async () => {
    prismaMock.crisisResponder.findFirst.mockResolvedValue({ id: "responder-1" });
    prismaMock.crisisEventUpdate.create.mockResolvedValue({
      id: "update-1",
      crisisEventId,
      updaterId: volunteerId,
      updater: { fullName: "Nadia Rahman" },
      previousStatus: "REPORTED",
      newStatus: "VERIFIED",
      updateType: "STATUS_CHANGE",
      verificationStatus: "RESPONDER_CONFIRMED",
      updateNote: "Water has crossed the school boundary and requires verified response.",
      newSeverity: "HIGH",
      affectedArea: "School boundary to market road",
      accessStatus: "LIMITED",
      casualtyCount: 2,
      displacedCount: 18,
      damageNotes: "Ground floor homes are fully submerged.",
      resourceNeedsText: JSON.stringify(["rescue boat", "dry food"]),
      closureAreaSafe: null,
      closurePeopleAccounted: null,
      closureNeedsStabilized: null,
      isFlagged: false,
      dismissedAt: null,
      createdAt: new Date("2026-04-22T10:00:00.000Z")
    });
    prismaMock.crisisEventUpdate.findMany.mockResolvedValue([
      {
        id: "update-1",
        crisisEventId,
        updaterId: volunteerId,
        updater: { fullName: "Nadia Rahman" },
        previousStatus: "REPORTED",
        newStatus: "VERIFIED",
        updateType: "STATUS_CHANGE",
        verificationStatus: "RESPONDER_CONFIRMED",
        updateNote: "Water has crossed the school boundary and requires verified response.",
        newSeverity: "HIGH",
        affectedArea: "School boundary to market road",
        accessStatus: "LIMITED",
        casualtyCount: 2,
        displacedCount: 18,
        damageNotes: "Ground floor homes are fully submerged.",
        resourceNeedsText: JSON.stringify(["rescue boat", "dry food"]),
        closureAreaSafe: null,
        closurePeopleAccounted: null,
        closureNeedsStabilized: null,
        isFlagged: false,
        dismissedAt: null,
        createdAt: new Date("2026-04-22T10:00:00.000Z")
      }
    ]);

    const result = await submitCrisisUpdate(crisisEventId, volunteerId, "VOLUNTEER", {
      updateType: "STATUS_CHANGE",
      status: "VERIFIED",
      updateNote: "Water has crossed the school boundary and requires verified response.",
      newSeverity: "HIGH",
      affectedArea: "School boundary to market road",
      accessStatus: "LIMITED",
      casualtyCount: 2,
      displacedCount: 18,
      damageNotes: "Ground floor homes are fully submerged.",
      resourceNeeds: ["rescue boat", "dry food"]
    });

    expect(prismaMock.crisisEventUpdate.create).toHaveBeenCalledWith({
      data: {
        crisisEventId,
        updaterId: volunteerId,
        previousStatus: "REPORTED",
        newStatus: "VERIFIED",
        updateNote: "Water has crossed the school boundary and requires verified response.",
        updateType: "STATUS_CHANGE",
        verificationStatus: "RESPONDER_CONFIRMED",
        newSeverity: "HIGH",
        affectedArea: "School boundary to market road",
        accessStatus: "LIMITED",
        casualtyCount: 2,
        displacedCount: 18,
        damageNotes: "Ground floor homes are fully submerged.",
        resourceNeedsText: JSON.stringify(["rescue boat", "dry food"]),
        closureAreaSafe: null,
        closurePeopleAccounted: null,
        closureNeedsStabilized: null,
        isFlagged: false
      },
      include: {
        updater: {
          select: {
            fullName: true
          }
        }
      }
    });
    expect(prismaMock.crisisEvent.update).toHaveBeenCalledWith({
      where: { id: crisisEventId },
      data: {
        status: "VERIFIED",
        severityLevel: "HIGH"
      }
    });
    expect(dispatchCrisisUpdateNotificationsMock).toHaveBeenCalledWith(
      crisisEventId,
      "FLOOD",
      "HIGH",
      "Ward 7 Flooding",
      "Water has crossed the school boundary and requires verified response.",
      "Verified",
      23.8103,
      90.4125
    );
    expect(triggerDispatchAlertsForCrisisMock).toHaveBeenCalledWith(crisisEventId);
    expect(result.applied).toBe(true);
    expect(result.entry.resourceNeeds).toEqual(["rescue boat", "dry food"]);
  });

  it("builds a command snapshot from the latest verified updates and responder roster", async () => {
    prismaMock.crisisEventUpdate.findMany.mockResolvedValue([
      {
        id: "update-system",
        crisisEventId,
        updaterId: volunteerId,
        updater: { fullName: "Nadia Rahman" },
        previousStatus: "VERIFIED",
        newStatus: "VERIFIED",
        updateType: "RESPONDER_STATUS",
        verificationStatus: "SYSTEM_LOGGED",
        updateNote: "Nadia Rahman moved from responding to on site.",
        newSeverity: null,
        affectedArea: null,
        accessStatus: null,
        casualtyCount: null,
        displacedCount: null,
        damageNotes: null,
        resourceNeedsText: null,
        closureAreaSafe: null,
        closurePeopleAccounted: null,
        closureNeedsStabilized: null,
        isFlagged: false,
        dismissedAt: null,
        createdAt: new Date("2026-04-22T12:00:00.000Z")
      },
      {
        id: "update-access",
        crisisEventId,
        updaterId: volunteerId,
        updater: { fullName: "Ayesha Khan" },
        previousStatus: "REPORTED",
        newStatus: "VERIFIED",
        updateType: "ACCESS_UPDATE",
        verificationStatus: "RESPONDER_CONFIRMED",
        updateNote: "Bridge approach is partially blocked by debris.",
        newSeverity: "HIGH",
        affectedArea: "Bridge approach to ward 7 school",
        accessStatus: "BLOCKED",
        casualtyCount: 3,
        displacedCount: null,
        damageNotes: null,
        resourceNeedsText: JSON.stringify(["excavator", "medical team"]),
        closureAreaSafe: null,
        closurePeopleAccounted: null,
        closureNeedsStabilized: null,
        isFlagged: false,
        dismissedAt: null,
        createdAt: new Date("2026-04-22T11:00:00.000Z")
      },
      {
        id: "update-impact",
        crisisEventId,
        updaterId: volunteerId,
        updater: { fullName: "Ayesha Khan" },
        previousStatus: "REPORTED",
        newStatus: "VERIFIED",
        updateType: "IMPACT_UPDATE",
        verificationStatus: "RESPONDER_CONFIRMED",
        updateNote: "Families have moved to the school shelter.",
        newSeverity: null,
        affectedArea: null,
        accessStatus: null,
        casualtyCount: null,
        displacedCount: 12,
        damageNotes: "North wing remains unstable.",
        resourceNeedsText: null,
        closureAreaSafe: null,
        closurePeopleAccounted: null,
        closureNeedsStabilized: null,
        isFlagged: false,
        dismissedAt: null,
        createdAt: new Date("2026-04-22T10:00:00.000Z")
      }
    ]);
    prismaMock.crisisResponder.findMany.mockResolvedValue([
      { status: "RESPONDING" },
      { status: "ON_SITE" },
      { status: "COMPLETED" },
      { status: "UNAVAILABLE" }
    ]);

    const snapshot = await getCrisisCommandCenter(crisisEventId);

    expect(snapshot.lastVerifiedBy).toBe("Ayesha Khan");
    expect(snapshot.latestUpdateType).toBe("ACCESS_UPDATE");
    expect(snapshot.accessStatus).toBe("BLOCKED");
    expect(snapshot.affectedArea).toBe("Bridge approach to ward 7 school");
    expect(snapshot.casualtyCount).toBe(3);
    expect(snapshot.displacedCount).toBe(12);
    expect(snapshot.damageNotes).toBe("North wing remains unstable.");
    expect(snapshot.resourceNeeds).toEqual(["excavator", "medical team"]);
    expect(snapshot.activeResponderCount).toBe(3);
    expect(snapshot.responderCounts).toEqual({
      RESPONDING: 1,
      EN_ROUTE: 0,
      ON_SITE: 1,
      COMPLETED: 1
    });
  });
});
