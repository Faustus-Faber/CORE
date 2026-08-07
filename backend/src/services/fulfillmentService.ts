import { prisma } from "../lib/prisma.js";
import { fulfillStock, releaseStock } from "./stockLedgerService.js";
import { logAuditEvent } from "./auditService.js";
import { SafeError } from "../utils/SafeError.js";

/**
 * FR-08: Record fulfillment for a delivered allocation.
 */
export async function recordFulfillment(params: {
  allocationId: string;
  deliveredQuantity: number;
  recipientName?: string;
  verificationNote?: string;
  evidenceUrls?: string[];
  recordedById: string;
  idempotencyKey?: string;
}) {
  const allocation = await prisma.allocation.findUnique({
    where: { id: params.allocationId },
    include: { need: true, resource: true },
  });

  if (!allocation) {
    throw new SafeError("Allocation not found");
  }

  // Authorization: only admin or resource owner can record fulfillment
  const actor = await prisma.user.findUnique({
    where: { id: params.recordedById },
    select: { role: true },
  });
  if (!actor || (actor.role !== "ADMIN" && allocation.resource.userId !== params.recordedById)) {
    throw new SafeError("Not authorized to fulfill this allocation");
  }

  if (allocation.status !== "READY" && allocation.status !== "PICKED_UP" && allocation.status !== "APPROVED") {
    throw new SafeError(`Cannot fulfill allocation in state ${allocation.status}`);
  }

  // Wrap core DB operations in a transaction for consistency
  const fulfillment = await prisma.$transaction(async (tx) => {
    const created = await tx.fulfillment.create({
      data: {
        allocationId: params.allocationId,
        deliveredQuantity: params.deliveredQuantity,
        recipientName: params.recipientName,
        verificationNote: params.verificationNote,
        evidenceUrls: params.evidenceUrls ?? [],
        recordedById: params.recordedById,
      },
    });

    // Update allocation to DELIVERED
    await tx.allocation.update({
      where: { id: params.allocationId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliveryNote: params.verificationNote,
      },
    });

    // Check if need is now met
    if (allocation.need) {
      const totalDelivered = await tx.fulfillment.aggregate({
        where: {
          allocation: { needId: allocation.needId },
        },
        _sum: { deliveredQuantity: true },
      });
      if ((totalDelivered._sum.deliveredQuantity ?? 0) >= allocation.need.quantity) {
        await tx.need.update({
          where: { id: allocation.needId },
          data: { isMet: true },
        });
      }
    }

    return created;
  });

  // Fulfill stock in the ledger (has its own idempotency check)
  await fulfillStock({
    resourceId: allocation.resourceId,
    allocationId: params.allocationId,
    quantity: params.deliveredQuantity,
    actorId: params.recordedById,
    idempotencyKey: params.idempotencyKey,
  });

  // Audit
  await logAuditEvent({
    actorId: params.recordedById,
    action: "FULFILLMENT_RECORDED",
    targetType: "Allocation",
    targetId: params.allocationId,
    afterJson: JSON.stringify({ deliveredQuantity: params.deliveredQuantity }),
  });

  return fulfillment;
}

/**
 * List fulfillments for an allocation.
 * Only admin or the resource owner can view fulfillments for an allocation.
 */
export async function listFulfillmentsForAllocation(allocationId: string, actorId: string) {
  const allocation = await prisma.allocation.findUnique({
    where: { id: allocationId },
    include: { resource: { select: { userId: true } } },
  });

  if (!allocation) {
    throw new SafeError("Allocation not found");
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  if (!actor || (actor.role !== "ADMIN" && allocation.resource.userId !== actorId)) {
    throw new SafeError("Not authorized to view fulfillments for this allocation");
  }

  return prisma.fulfillment.findMany({
    where: { allocationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
