import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  crisisEvent: {
    findUnique: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  },
  crisisResponder: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock
}));

import {
  listCrisisResponders,
  upsertCrisisResponderStatus
} from "../services/crisisResponderService.js";

const crisisEventId = "507f1f77bcf86cd799439013";
const volunteerId = "507f1f77bcf86cd799439012";

describe("crisisResponderService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.crisisEvent.findUnique.mockResolvedValue({ id: crisisEventId });
    prismaMock.user.findUnique.mockResolvedValue({
      role: "VOLUNTEER",
      isBanned: false
    });
  });

  it("creates a responder row when volunteer opts in for the first time", async () => {
    prismaMock.crisisResponder.findUnique.mockResolvedValue(null);
    prismaMock.crisisResponder.create.mockResolvedValue({
      id: "responder-1",
      volunteerId,
      status: "RESPONDING",
      optedInAt: new Date("2026-04-21T10:00:00.000Z"),
      lastStatusAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      volunteer: {
        fullName: "Jamal Hossain",
        avatarUrl: null,
        skills: ["First Aid"],
        location: "Dhaka"
      }
    });

    const result = await upsertCrisisResponderStatus(
      crisisEventId,
      volunteerId,
      "RESPONDING"
    );

    expect(prismaMock.crisisResponder.create).toHaveBeenCalledOnce();
    expect(result.status).toBe("RESPONDING");
    expect(result.volunteerName).toBe("Jamal Hossain");
  });

  it("rejects invalid status transitions", async () => {
    prismaMock.crisisResponder.findUnique.mockResolvedValue({
      id: "responder-1",
      volunteerId,
      status: "EN_ROUTE",
      optedInAt: new Date("2026-04-21T10:00:00.000Z"),
      lastStatusAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      volunteer: {
        fullName: "Jamal Hossain",
        avatarUrl: null,
        skills: ["First Aid"],
        location: "Dhaka"
      }
    });

    await expect(
      upsertCrisisResponderStatus(crisisEventId, volunteerId, "RESPONDING")
    ).rejects.toThrow("Invalid responder status transition: EN_ROUTE -> RESPONDING");
    expect(prismaMock.crisisResponder.update).not.toHaveBeenCalled();
  });

  it("filters unavailable responders from public list", async () => {
    prismaMock.crisisResponder.findMany.mockResolvedValue([]);

    await listCrisisResponders(crisisEventId, false);

    expect(prismaMock.crisisResponder.findMany).toHaveBeenCalledWith({
      where: {
        crisisEventId,
        status: { not: "UNAVAILABLE" }
      },
      include: {
        volunteer: {
          select: {
            fullName: true,
            avatarUrl: true,
            skills: true,
            location: true
          }
        }
      },
      orderBy: [{ lastStatusAt: "desc" }]
    });
  });
});
