import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  notification: {
    create: vi.fn(),
    deleteMany: vi.fn()
  },
  resource: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  reservation: {
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  resourceHistory: {
    create: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock
}));

import {
  approveReservation,
  createReservation,
  expireReservations
} from "../services/resourceService.js";

describe("resourceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a minimum reservation of one item for small inventories", async () => {
    prismaMock.resource.findUnique.mockResolvedValue({
      id: "resource-1",
      userId: "owner-1",
      name: "Water Pack",
      unit: "packs",
      quantity: 2,
      originalQuantity: 2,
      status: "Available"
    });
    prismaMock.reservation.count.mockResolvedValue(0);
    prismaMock.reservation.aggregate.mockResolvedValue({
      _sum: { quantity: 0 }
    });
    prismaMock.reservation.create.mockResolvedValue({
      id: "reservation-1",
      resourceId: "resource-1",
      userId: "user-1",
      quantity: 1,
      justification: "Needed for two displaced family members",
      status: "Pending"
    });
    prismaMock.notification.create.mockResolvedValue({});

    const reservation = await createReservation(
      "user-1",
      "resource-1",
      1,
      "Needed for two displaced family members"
    );

    expect(reservation.id).toBe("reservation-1");
    expect(prismaMock.reservation.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        resourceId: "resource-1",
        quantity: 1,
        justification: "Needed for two displaced family members",
        pickupTime: undefined,
        status: "Pending"
      }
    });
  });

  it("blocks non-owners from approving reservations", async () => {
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        reservation: {
          findUnique: vi.fn().mockResolvedValue({
            id: "reservation-1",
            status: "Pending",
            quantity: 2,
            userId: "requester-1",
            resourceId: "resource-1",
            resource: {
              id: "resource-1",
              userId: "owner-1",
              name: "Rice",
              unit: "kg",
              quantity: 10,
              originalQuantity: 10,
              status: "Available"
            }
          }),
          update: vi.fn()
        },
        resource: {
          update: vi.fn()
        },
        notification: {
          create: vi.fn(),
          deleteMany: vi.fn()
        },
        resourceHistory: {
          create: vi.fn()
        }
      })
    );

    await expect(approveReservation("intruder-1", "USER", "reservation-1")).rejects.toThrow(
      "Only the resource owner or an admin can manage this reservation"
    );
  });

  it("expires approved reservations after 24 hours and restores stock", async () => {
    const resource = {
      id: "resource-1",
      quantity: 4,
      originalQuantity: 10,
      status: "Low Stock"
    };

    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: "reservation-1",
        resourceId: "resource-1",
        quantity: 3,
        status: "Approved",
        pickupTime: new Date("2026-04-20T08:00:00.000Z")
      }
    ]);
    prismaMock.resource.findUnique.mockResolvedValue(resource);
    prismaMock.reservation.update.mockReturnValue({ mutation: "reservation.update" } as never);
    prismaMock.resource.update.mockReturnValue({ mutation: "resource.update" } as never);
    prismaMock.resourceHistory.create.mockReturnValue({ mutation: "resourceHistory.create" } as never);
    prismaMock.$transaction.mockResolvedValue([]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T10:00:00.000Z"));

    const result = await expireReservations();

    expect(result.count).toBe(1);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: {
        status: "Expired",
        decisionReason: "Reservation expired after the pickup window elapsed"
      }
    });
    expect(prismaMock.resource.update).toHaveBeenCalledWith({
      where: { id: "resource-1" },
      data: {
        quantity: 7,
        status: "Available",
        originalQuantity: 10
      }
    });

    vi.useRealTimers();
  });
});
