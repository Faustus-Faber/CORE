import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $runCommandRaw: vi.fn(),
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  crisisEvent: {
    findUnique: vi.fn()
  },
  crisisResponder: {
    findFirst: vi.fn()
  },
  crisisEventReport: {
    findFirst: vi.fn()
  },
  secureFolder: {
    findFirst: vi.fn()
  },
  evidencePost: {
    findMany: vi.fn()
  },
  reservation: {
    findMany: vi.fn()
  },
  review: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock
}));

import { submitReview } from "../services/reviewService.js";

const reviewerId = "507f1f77bcf86cd799439011";
const volunteerId = "507f1f77bcf86cd799439012";
const crisisEventId = "507f1f77bcf86cd799439013";

const basePayload = {
  volunteerId,
  rating: 5,
  text: "Volunteer arrived quickly and coordinated relief safely.",
  interactionContext: "RESCUE_OPERATION" as const,
  interactionDate: "2026-04-20T10:00:00.000Z",
  wouldWorkAgain: true,
  crisisEventId
};

describe("submitReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.$runCommandRaw.mockResolvedValue({ n: 0 });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.review.findMany.mockResolvedValue([]);
    prismaMock.review.count.mockResolvedValue(0);
    prismaMock.review.create.mockResolvedValue({
      id: "review-1",
      ...basePayload,
      reviewerId,
      isFlagged: false,
      flagReasons: [],
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      reviewer: { fullName: "Nadia Rahman", avatarUrl: null }
    });
    prismaMock.evidencePost.findMany.mockResolvedValue([]);
    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.secureFolder.findFirst.mockResolvedValue(null);
  });

  it("rejects review submission when reviewer is outside crisis radius", async () => {
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === reviewerId) {
          return Promise.resolve({
            role: "USER",
            isBanned: false,
            latitude: 24.0,
            longitude: 90.0,
            createdAt: new Date("2026-01-01T00:00:00.000Z")
          });
        }

        if (where.id === volunteerId) {
          return Promise.resolve({ role: "VOLUNTEER" });
        }

        return Promise.resolve(null);
      }
    );

    prismaMock.crisisEvent.findUnique.mockResolvedValue({
      id: crisisEventId,
      latitude: 23.8103,
      longitude: 90.4125
    });
    prismaMock.crisisResponder.findFirst.mockResolvedValue({ id: "responder-1" });

    await expect(submitReview(reviewerId, basePayload)).rejects.toThrow(
      "Only users near this crisis can review responders"
    );
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("enforces duplicate check per volunteer and crisis", async () => {
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === reviewerId) {
          return Promise.resolve({
            role: "USER",
            isBanned: false,
            latitude: 23.8103,
            longitude: 90.4125,
            createdAt: new Date("2026-01-01T00:00:00.000Z")
          });
        }

        if (where.id === volunteerId) {
          return Promise.resolve({ role: "VOLUNTEER" });
        }

        return Promise.resolve(null);
      }
    );

    prismaMock.crisisEvent.findUnique.mockResolvedValue({
      id: crisisEventId,
      latitude: 23.8103,
      longitude: 90.4125
    });
    prismaMock.crisisResponder.findFirst.mockResolvedValue({ id: "responder-1" });
    prismaMock.crisisEventReport.findFirst.mockResolvedValue({ id: "interaction-1" });
    prismaMock.review.findFirst.mockResolvedValue({ id: "existing-review" });

    await expect(submitReview(reviewerId, basePayload)).rejects.toThrow(
      "You have already reviewed this responder for this crisis"
    );

    expect(prismaMock.review.findFirst).toHaveBeenCalledWith({
      where: {
        reviewerId,
        volunteerId,
        crisisEventId
      }
    });
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });
});
