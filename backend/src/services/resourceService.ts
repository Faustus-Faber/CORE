import { prisma } from "../lib/prisma.js";
import { enqueueJob } from "./outboxService.js";
import { metrics } from "../utils/metrics.js";
import { SafeError } from "../utils/SafeError.js";

export interface CreateResourceData {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  condition: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPreference: string;
  userId: string;
  availabilityStart?: Date;
  availabilityEnd?: Date;
  notes?: string;
  photos?: string[];
}

export interface UpdateResourceData {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  condition?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  contactPreference?: string;
  availabilityStart?: Date | string;
  availabilityEnd?: Date | string;
  notes?: string;
  photos?: string[];
  status?: string;
}

type ResourceRecord = Awaited<ReturnType<typeof prisma.resource.findUnique>>;

type ReservationStatus = "Pending" | "Approved" | "Declined" | "Expired";

function resolveOriginalQuantity(resource: NonNullable<ResourceRecord>) {
  return resource.originalQuantity ?? resource.quantity;
}

async function getPendingHeldQuantity(resourceId: string) {
  const pendingSum = await prisma.reservation.aggregate({
    where: {
      resourceId,
      status: "Pending"
    },
    _sum: {
      quantity: true
    }
  });

  return pendingSum._sum.quantity ?? 0;
}

function deriveResourceStatus(input: {
  quantity: number;
  originalQuantity: number;
  heldQuantity: number;
  currentStatus: string;
  requestedStatus?: string;
}) {
  const { quantity, originalQuantity, heldQuantity, currentStatus, requestedStatus } = input;

  if (requestedStatus === "Unavailable") {
    return "Unavailable";
  }

  if (quantity <= 0) {
    return "Depleted";
  }

  const availableToReserve = Math.max(quantity - heldQuantity, 0);

  if (availableToReserve <= 0) {
    return "Reserved";
  }

  const lowStockThreshold = Math.max(1, Math.ceil(originalQuantity * 0.3));

  if (quantity <= lowStockThreshold || requestedStatus === "Low Stock") {
    return "Low Stock";
  }

  if (requestedStatus === "Depleted") {
    return "Depleted";
  }

  if (requestedStatus === "Reserved") {
    return "Reserved";
  }

  if (requestedStatus === "Available") {
    return "Available";
  }

  return currentStatus === "Unavailable" ? "Unavailable" : "Available";
}

async function recordResourceHistory(
  resourceId: string,
  oldStatus: string,
  newStatus: string,
  oldQuantity: number,
  newQuantity: number
) {
  if (oldStatus === newStatus && oldQuantity === newQuantity) {
    return;
  }

  await prisma.resourceHistory.create({
    data: {
      resourceId,
      oldStatus,
      newStatus,
      oldQuantity,
      newQuantity
    }
  });
}

async function syncResourceAvailability(resourceId: string) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId }
  });

  if (!resource) {
    return null;
  }

  if (resource.status === "Unavailable") {
    return resource;
  }

  const heldQuantity = await getPendingHeldQuantity(resourceId);
  const originalQuantity = resolveOriginalQuantity(resource);
  const nextStatus = deriveResourceStatus({
    quantity: resource.quantity,
    originalQuantity,
    heldQuantity,
    currentStatus: resource.status
  });

  if (nextStatus === resource.status) {
    return resource;
  }

  const updated = await prisma.resource.update({
    where: { id: resourceId },
    data: { status: nextStatus }
  });

  await recordResourceHistory(resourceId, resource.status, nextStatus, resource.quantity, resource.quantity);

  return updated;
}

export async function createResource(data: CreateResourceData) {
  return prisma.resource.create({
    data: {
      ...data,
      originalQuantity: data.quantity,
      status: "Available"
    }
  });
}

export async function getResourceById(id: string) {
  try {
    return await prisma.resource.findUnique({
      where: { id }
    });
  } catch {
    return null;
  }
}

export async function getUserResources(userId: string) {
  return prisma.resource.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function deactivateResource(id: string) {
  const existing = await prisma.resource.findUnique({
    where: { id }
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.resource.update({
    where: { id },
    data: { status: "Unavailable" }
  });

  await recordResourceHistory(id, existing.status, "Unavailable", existing.quantity, existing.quantity);

  return updated;
}

export async function deleteResource(id: string) {
  // Allocation doesn't have onDelete: Cascade, so we need to handle it
  // Check if resource has active allocations before deleting
  const activeAllocations = await prisma.allocation.count({
    where: { resourceId: id, status: { notIn: ["DELIVERED", "CANCELLED"] } }
  });

  if (activeAllocations > 0) {
    throw new SafeError("Cannot delete resource with active allocations");
  }

  // Delete non-cascade related records and the resource in a transaction
  return prisma.$transaction(async (tx) => {
    // Delete allocations that reference this resource (DELIVERED/CANCELLED only at this point)
    await tx.allocation.deleteMany({
      where: { resourceId: id }
    });

    return tx.resource.delete({
      where: { id }
    });
  });
}

export async function updateResource(id: string, data: UpdateResourceData) {
  // Wrap read-check-update in a transaction to prevent race conditions
  // where concurrent updates could both pass the heldQuantity check
  return prisma.$transaction(async (tx) => {
    const existing = await tx.resource.findUnique({
      where: { id }
    });

    if (!existing) {
      return null;
    }

    const originalQuantity = resolveOriginalQuantity(existing);
    const nextQuantity = data.quantity ?? existing.quantity;

    if (nextQuantity < 0) {
      throw new SafeError("Quantity cannot be negative");
    }

    if (nextQuantity > originalQuantity) {
      throw new SafeError("Quantity cannot exceed original amount");
    }

    // Calculate held quantity inside the transaction
    const pendingSum = await tx.reservation.aggregate({
      where: { resourceId: id, status: "Pending" },
      _sum: { quantity: true }
    });
    const heldQuantity = pendingSum._sum.quantity ?? 0;

    // Prevent setting quantity below the amount held by pending reservations
    if (nextQuantity < heldQuantity) {
      throw new SafeError(`Quantity cannot be reduced below ${heldQuantity} units currently held by pending reservations`);
    }
    const nextStatus = deriveResourceStatus({
      quantity: nextQuantity,
      originalQuantity,
      heldQuantity,
      currentStatus: existing.status,
      requestedStatus: data.status
    });

    const updated = await tx.resource.update({
      where: { id },
      data: {
        ...data,
        originalQuantity,
        quantity: nextQuantity,
        status: nextStatus
      }
    });

    // Record history inside the transaction
    if (existing.status !== nextStatus || existing.quantity !== nextQuantity) {
      await tx.resourceHistory.create({
        data: {
          resourceId: id,
          oldStatus: existing.status,
          newStatus: nextStatus,
          oldQuantity: existing.quantity,
          newQuantity: nextQuantity,
        }
      });
    }

    return updated;
  });
}

export async function getMapResources() {
  return prisma.resource.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      quantity: true,
      unit: true,
      address: true,
      latitude: true,
      longitude: true,
      contactPreference: true,
      status: true,
      notes: true
    },
    take: 500
  });
}

export async function createReservation(
  userId: string,
  resourceId: string,
  quantity: number,
  justification: string,
  pickupTime?: Date
) {
  // Validate quantity before entering the transaction
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new SafeError("Reservation quantity must be a positive number");
  }

  // P0-12: Wrap stock check + reservation creation in a transaction to prevent race conditions
  const reservation = await prisma.$transaction(async (tx) => {
    const resource = await tx.resource.findUnique({
      where: { id: resourceId }
    });

    if (!resource) {
      throw new SafeError("Resource not found");
    }

    if (!["Available", "Low Stock"].includes(resource.status)) {
      throw new SafeError("Resource not reservable");
    }

    const originalQuantity = resolveOriginalQuantity(resource);
    const maxAllowed = Math.max(1, Math.floor(originalQuantity * 0.3));

    if (quantity > maxAllowed) {
      throw new SafeError(`You can reserve up to ${maxAllowed} units of this resource`);
    }

    const activeCount = await tx.reservation.count({
      where: {
        userId,
        resourceId,
        status: {
          in: ["Pending", "Approved"]
        }
      }
    });

    if (activeCount >= 3) {
      throw new SafeError("Max 3 active reservations reached");
    }

    // P0-12: Calculate held quantity inside the transaction
    const pendingSum = await tx.reservation.aggregate({
      where: {
        resourceId,
        status: "Pending"
      },
      _sum: {
        quantity: true
      }
    });
    const heldQuantity = pendingSum._sum.quantity ?? 0;
    const availableToReserve = Math.max(resource.quantity - heldQuantity, 0);

    if (quantity > availableToReserve) {
      throw new SafeError("Not enough available stock");
    }

    return tx.reservation.create({
      data: {
        userId,
        resourceId,
        quantity,
        justification,
        pickupTime,
        status: "Pending"
      }
    });
  });

  const resourceOwner = await prisma.resource.findUnique({
    where: { id: reservation.resourceId },
    select: { userId: true }
  });
  if (resourceOwner) {
    // P0-11: Create notification inside the same transaction via outbox pattern
    const notification = await prisma.notification.create({
      data: {
        userId: resourceOwner.userId,
        title: "New Reservation Request",
        body: `Request for ${quantity} units`,
        type: "RESERVATION_REQUEST",
        reservationId: reservation.id,
        deliveryState: "QUEUED"
      }
    }).catch((err) => {
      console.error("Failed to create reservation notification:", err);
      return null;
    });

    if (notification) {
      await enqueueJob({
        jobType: "NOTIFICATION_DISPATCH",
        payload: {
          notificationId: notification.id,
          userId: resourceOwner.userId,
          title: "New Reservation Request",
          body: `Request for ${quantity} units`,
          url: `/resources/${reservation.resourceId}`,
        },
        targetEntityId: notification.id,
        dedupeKey: `notif-${notification.id}`,
      }).catch((err) => console.error("[outbox] Failed to enqueue reservation notification:", err));
    }
  }

  await syncResourceAvailability(resourceId);

  return reservation;
}

export async function listReservationsForOwner(resourceId: string) {
  return prisma.reservation.findMany({
    where: { resourceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          location: true
        }
      }
    }
  });
}

export async function listResourceHistory(resourceId: string) {
  return prisma.resourceHistory.findMany({
    where: { resourceId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

async function transitionReservation(
  actorId: string,
  actorRole: string,
  reservationId: string,
  nextStatus: Extract<ReservationStatus, "Approved" | "Declined">,
  decisionReason?: string
) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        resource: true
      }
    });

    if (!reservation) {
      throw new SafeError("Reservation not found");
    }

    const canManage = actorRole === "ADMIN" || reservation.resource.userId === actorId;
    if (!canManage) {
      throw new SafeError("Only the resource owner or an admin can manage this reservation");
    }

    if (reservation.status !== "Pending") {
      throw new SafeError(`Only pending reservations can be ${nextStatus.toLowerCase()}`);
    }

    // Prevent approving expired reservations
    if (nextStatus === "Approved" && reservation.pickupTime && reservation.pickupTime < new Date()) {
      throw new SafeError("Cannot approve a reservation whose pickup time has already passed");
    }

    let nextQuantity = reservation.resource.quantity;
    let nextResourceStatus = reservation.resource.status;

    if (nextStatus === "Approved") {
      if (reservation.resource.quantity < reservation.quantity) {
        throw new SafeError("Insufficient stock");
      }

      nextQuantity = reservation.resource.quantity - reservation.quantity;
      nextResourceStatus = deriveResourceStatus({
        quantity: nextQuantity,
        originalQuantity: resolveOriginalQuantity(reservation.resource),
        heldQuantity: 0,
        currentStatus: reservation.resource.status
      });
    }

    const updatedReservation = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: nextStatus,
        decisionReason: decisionReason?.trim() || null
      }
    });

    if (nextStatus === "Approved") {
      await tx.resource.update({
        where: { id: reservation.resource.id },
        data: {
          quantity: nextQuantity,
          status: nextResourceStatus,
          originalQuantity: resolveOriginalQuantity(reservation.resource)
        }
      });

      await tx.resourceHistory.create({
        data: {
          resourceId: reservation.resource.id,
          oldStatus: reservation.resource.status,
          newStatus: nextResourceStatus,
          oldQuantity: reservation.resource.quantity,
          newQuantity: nextQuantity
        }
      });
    }

    const decisionText = nextStatus === "Approved" ? "approved" : "declined";
    const body =
      nextStatus === "Approved"
        ? `Your request for ${reservation.quantity} ${reservation.resource.unit} of ${reservation.resource.name} was approved`
        : `Your request for ${reservation.resource.name} was declined`;

    await tx.notification.create({
      data: {
        userId: reservation.userId,
        title: `Reservation ${nextStatus}`,
        body,
        type: nextStatus === "Approved" ? "RESERVATION_APPROVED" : "RESERVATION_DECLINED",
        reservationId: reservation.id,
        statusSnapshot: decisionText.toUpperCase()
      }
    });

    await tx.notification.deleteMany({
      where: {
        reservationId: reservation.id,
        type: "RESERVATION_REQUEST"
      }
    });

    return updatedReservation;
  }).then(async (reservation) => {
    await syncResourceAvailability(reservation.resourceId);
    return reservation;
  });
}

export async function approveReservation(
  actorId: string,
  actorRole: string,
  reservationId: string
) {
  return transitionReservation(actorId, actorRole, reservationId, "Approved");
}

export async function declineReservation(
  actorId: string,
  actorRole: string,
  reservationId: string,
  decisionReason?: string
) {
  return transitionReservation(actorId, actorRole, reservationId, "Declined", decisionReason);
}

export async function expireReservations() {
  const expirationThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "Approved",
      pickupTime: {
        not: null,
        lte: expirationThreshold
      }
    },
    take: 500
  });

  let expiredCount = 0;

  for (const reservation of reservations) {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to prevent double-processing
      const current = await tx.reservation.findUnique({
        where: { id: reservation.id },
        select: { status: true }
      });
      if (!current || current.status !== "Approved") {
        return null;
      }

      const resource = await tx.resource.findUnique({
        where: { id: reservation.resourceId }
      });

      if (!resource) {
        return null;
      }

      const originalQuantity = resolveOriginalQuantity(resource);
      const restoredQuantity = Math.min(resource.quantity + reservation.quantity, originalQuantity);
      const nextStatus = deriveResourceStatus({
        quantity: restoredQuantity,
        originalQuantity,
        heldQuantity: 0,
        currentStatus: resource.status
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: "Expired",
          decisionReason: "Reservation expired after the pickup window elapsed"
        }
      });
      await tx.resource.update({
        where: { id: resource.id },
        data: {
          quantity: restoredQuantity,
          status: nextStatus,
          originalQuantity
        }
      });
      await tx.resourceHistory.create({
        data: {
          resourceId: resource.id,
          oldStatus: resource.status,
          newStatus: nextStatus,
          oldQuantity: resource.quantity,
          newQuantity: restoredQuantity
        }
      });

      return { resource };
    });

    if (!result) {
      continue;
    }

    // §15.4: Record allocation expiry metric for each expired reservation
    metrics.recordAllocationExpiry();

    expiredCount += 1;
  }

  return { count: expiredCount };
}
