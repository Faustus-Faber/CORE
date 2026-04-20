import { prisma } from "../lib/prisma.js";

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

export async function createResource(data: CreateResourceData) {
  return prisma.resource.create({
    data: {
      ...data,
      status: "Available"
    }
  });
}

export async function getResourceById(id: string) {
  try {
    return prisma.resource.findUnique({
      where: { id }
    });
  } catch {
    return null;
  }
}

export async function getUserResources(userId: string) {
  return prisma.resource.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

export async function deactivateResource(id: string) {
  return prisma.resource.update({
    where: { id },
    data: { status: "Unavailable" }
  }).catch(() => null);
}

export async function deleteResource(id: string) {
  return prisma.resource.delete({
    where: { id }
  }).catch(() => null);
}

export async function updateResource(id: string, data: UpdateResourceData) {
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) return null;

  if (data.quantity !== undefined && data.quantity > existing.quantity) {
    throw new Error("Quantity cannot exceed original amount");
  }

  let newStatus = data.status;

  if (data.quantity === 0) {
    newStatus = "Depleted";
  }

  const updated = await prisma.resource.update({
    where: { id },
    data: {
      ...data,
      status: newStatus ?? existing.status
    }
  });

  await prisma.resourceHistory.create({
    data: {
      resourceId: id,
      oldStatus: existing.status,
      newStatus: newStatus || existing.status,
      oldQuantity: existing.quantity,
      newQuantity: data.quantity ?? existing.quantity
    }
  });

  return updated;
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
      status: true
    }
  });
}


export async function createReservation(userId: string, resourceId: string, quantity: number, justification: string, pickupTime?: Date) {

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw new Error("Resource not found");

  if (!["Available", "Low Stock"].includes(resource.status)) {
    throw new Error("Resource not reservable");
  }

const maxAllowed = Math.max(1, Math.floor(resource.quantity * 0.3));

if (quantity > maxAllowed) {
  throw new Error(`You can reserve up to ${maxAllowed} units only`);
}

  const activeCount = await prisma.reservation.count({
    where: {
      userId,
      resourceId,
      status: { in: ["Pending", "Approved"] }
    }
  });

  if (activeCount >= 3) {
    throw new Error("Max 3 active reservations reached");
  }

  const pendingSum = await prisma.reservation.aggregate({
    where: {
      resourceId,
      status: "Pending"
    },
    _sum: { quantity: true }
  });

  const held = pendingSum._sum.quantity || 0;
  const available = resource.quantity - held;

  if (quantity > available) {
    throw new Error("Not enough available stock");
  }

const reservation = await prisma.reservation.create({
  data: {
    userId,
    resourceId,
    quantity,
    justification,
    pickupTime,
    status: "Pending"
  }
});

const owner = await prisma.resource.findUnique({
  where: { id: resourceId },
  select: { userId: true, name: true }
});

if (owner) {
  await prisma.notification.create({
    data: {
      userId: owner.userId,
      title: "New Reservation Request",
      body: `Request for ${quantity} ${resource.unit} of ${resource.name}`,
      type: "RESERVATION_REQUEST",
      reservationId: reservation.id
    }

  });
}

return reservation;
}

export async function approveReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId }
    });
    if (!reservation) throw new Error("Not found");

    const resource = await tx.resource.findUnique({
      where: { id: reservation.resourceId }
    });

    if (!resource || resource.quantity < reservation.quantity) {
      throw new Error("Insufficient stock");
    }

const newQuantity = resource.quantity - reservation.quantity;

let newStatus = resource.status;

if (newQuantity === 0) {
  newStatus = "Depleted";
}

await tx.resource.update({
  where: { id: resource.id },
  data: {
    quantity: newQuantity,
    status: newStatus
  }
});

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "Approved" }
    });

    await tx.notification.create({
      data: {
        userId: reservation.userId,
        title: "Reservation Approved",
        body: `Your request for ${reservation.quantity} ${resource.unit} of ${resource.name} was approved`,
        type: "RESERVATION_APPROVED",
        reservationId: reservation.id
      }
    });

    await tx.notification.deleteMany({
  where: {
    reservationId: reservation.id,
    type: "RESERVATION_REQUEST"
  }
});

    return updated;
  });
}


export async function declineReservation(reservationId: string) {
  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "Declined" }
  });

  const resource = await prisma.resource.findUnique({
    where: { id: reservation.resourceId }
  });

  if (resource) {
    await prisma.notification.create({
      data: {
        userId: reservation.userId,
        title: "Reservation Declined",
        body: `Your request for ${resource.name} was declined`,
        type: "RESERVATION_DECLINED",
        reservationId: reservation.id
      }
    });

    await prisma.notification.deleteMany({
  where: {
    reservationId: reservation.id,
    type: "RESERVATION_REQUEST"
  }
});
  }

  return reservation;
}

export async function expireReservations() {
  const now = new Date();

  const expired = await prisma.reservation.updateMany({
    where: {
      status: "Approved",
      pickupTime: { lt: now }
    },
    data: { status: "Expired" }
  });

  return expired;
}