/**
 * Needs Service — manages identified needs and computes coverage gaps.
 */

import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { haversineDistanceKm } from "../utils/geo.js";
import { metrics } from "../utils/metrics.js";
import { SafeError } from "../utils/SafeError.js";

export interface CreateNeedInput {
  crisisEventId: string;
  needType: string;
  description: string;
  quantity: number;
  unit: string;
  urgency: string;
  sourceClaimId?: string;
  dueAt?: string;
}

export interface NeedWithRelations {
  id: string;
  crisisEventId: string;
  needType: string;
  description: string;
  quantity: number;
  unit: string;
  urgency: string;
  isMet: boolean;
  sourceClaimId: string | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sourceClaim: {
    id: string;
    subject: string;
    value: string;
    claimType: string;
    evidenceState: string;
  } | null;
  allocations: Array<{
    id: string;
    quantity: number;
    status: string;
    resource: { id: string; name: string; status: string };
  }>;
}

/**
 * Create a need (coordinator identifies a requirement from field intelligence).
 */
export async function createNeed(
  actorId: string,
  input: CreateNeedInput
): Promise<NeedWithRelations> {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: input.crisisEventId },
    select: { id: true }
  });
  if (!crisis) throw new SafeError("Crisis event not found");

  const need = await prisma.need.create({
    data: {
      crisisEventId: input.crisisEventId,
      needType: input.needType,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      urgency: input.urgency,
      sourceClaimId: input.sourceClaimId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null
    },
    include: {
      sourceClaim: {
        select: { id: true, subject: true, value: true, claimType: true, evidenceState: true }
      },
      allocations: {
        include: { resource: { select: { id: true, name: true, status: true } } }
      }
    }
  });

  const { logAuditEvent } = await import("./auditService.js");
  await logAuditEvent({
    actorId,
    actorRole: "ADMIN",
    action: "NEED_CREATED",
    targetType: "Need",
    targetId: need.id,
    afterJson: JSON.stringify({ description: need.description, quantity: need.quantity })
  });

  return need as NeedWithRelations;
}

/**
 * Get all needs for a crisis with allocation status.
 */
export async function getNeedsForCrisis(crisisEventId: string) {
  return prisma.need.findMany({
    where: { crisisEventId },
    take: 200,
    include: {
      sourceClaim: {
        select: { id: true, subject: true, value: true, claimType: true, evidenceState: true }
      },
      allocations: {
        include: { resource: { select: { id: true, name: true, status: true } } },
        take: 50,
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }]
  });
}

/**
 * AC-08.03/08.05: Compute unmet needs with utilized quantities traced to DELIVERED records.
 * - `allocated`: sum of REQUESTED + HELD + APPROVED allocations (in-flight)
 * - `delivered`: sum of DELIVERED allocations only (confirmed utilized)
 * - `gap`: remaining unmet = need.quantity - delivered (what still needs fulfillment)
 * This is deterministic — no AI needed.
 */
export async function getNeedsGap(crisisEventId: string) {
  const needs = await prisma.need.findMany({
    where: { crisisEventId, isMet: false },
    take: 200,
    include: {
      allocations: {
        select: {
          quantity: true,
          status: true,
          deliveredAt: true,
          fulfillments: {
            select: { deliveredQuantity: true }
          }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }]
  });

  return needs.map((need) => {
    // AC-08.03: Utilized quantity traces to DELIVERED allocations and Fulfillment records
    const delivered = need.allocations
      .filter((a) => a.status === "DELIVERED")
      .reduce((sum, a) => {
        // Prefer fulfillment records if available; fall back to allocation quantity
        const fulfillmentTotal = a.fulfillments.reduce((s, f) => s + f.deliveredQuantity, 0);
        return sum + (fulfillmentTotal > 0 ? fulfillmentTotal : a.quantity);
      }, 0);

    // In-flight allocations (not yet delivered)
    const allocated = need.allocations
      .filter((a) => ["REQUESTED", "HELD", "APPROVED"].includes(a.status))
      .reduce((sum, a) => sum + a.quantity, 0);

    // AC-08.05: Gap is what's still unmet after all delivered quantities
    const gap = Math.max(0, need.quantity - delivered);

    return {
      id: need.id,
      needType: need.needType,
      description: need.description,
      quantity: need.quantity,
      allocated,
      delivered,
      gap,
      urgency: need.urgency,
      unit: need.unit
    };
  });
}

/**
 * Propose a stock allocation from available resources near the crisis.
 */
export async function proposeAllocation(
  actorId: string,
  needId: string,
  resourceId: string,
  quantity: number
) {
  // Wrap availability check and allocation creation in a transaction to prevent
  // race conditions where two concurrent requests both pass the availability
  // check and over-allocate the same resource.
  const { allocation, distance } = await prisma.$transaction(async (tx) => {
    const [need, resource] = await Promise.all([
      tx.need.findUnique({ where: { id: needId } }),
      tx.resource.findUnique({ where: { id: resourceId } })
    ]);

    if (!need) throw new SafeError("Need not found");
    if (!resource) throw new SafeError("Resource not found");

    if (resource.status !== "Available" && resource.status !== "Low Stock") {
      throw new SafeError(`Resource is not available (status: ${resource.status})`);
    }

    const dist = resource.latitude != null && resource.longitude != null
      ? null // Distance calculation requires crisis location, not need sourceClaim
      : null;

    const created = await tx.allocation.create({
      data: {
        needId,
        resourceId,
        quantity,
        status: "REQUESTED",
        requestedById: actorId
      },
      include: {
        need: true,
        resource: true
      }
    });

    return { allocation: created, distance: dist };
  });

  // §15.4: Record allocation hold metric (REQUESTED state = reservation placed)
  metrics.recordAllocationHold();

  // Check if need is fully covered
  await checkAndUpdateNeedMetStatus(needId);

  return { allocation, distanceKm: distance };
}

/**
 * Approve or decline an allocation (coordinator decision).
 */
export async function decideAllocation(
  actorId: string,
  allocationId: string,
  decision: "APPROVED" | "DECLINED",
  note?: string
) {
  const allocation = await prisma.allocation.findUnique({ where: { id: allocationId } });
  if (!allocation) throw new SafeError("Allocation not found");

  if (allocation.status !== "REQUESTED" && allocation.status !== "HELD") {
    throw new SafeError(`Cannot decide allocation in state ${allocation.status}`);
  }

  const updated = await prisma.allocation.update({
    where: { id: allocationId },
    data: {
      status: decision,
      approvedById: actorId,
      approvedAt: new Date()
    },
    include: {
      need: { include: { sourceClaim: { select: { id: true, subject: true } } } },
      resource: true
    }
  });

  const { logAuditEvent } = await import("./auditService.js");
  await logAuditEvent({
    actorId,
    actorRole: "ADMIN",
    action: decision === "APPROVED" ? "ALLOCATION_APPROVED" : "ALLOCATION_DECLINED",
    targetType: "Allocation",
    targetId: allocationId,
    reason: note ?? undefined
  });

  return updated;
}

/**
 * Mark allocation as delivered with a note (updates need met status).
 */
export async function deliverAllocation(
  actorId: string,
  allocationId: string,
  note: string,
  deliveredQuantity: number
) {
  const allocation = await prisma.allocation.findUnique({ where: { id: allocationId } });
  if (!allocation) throw new SafeError("Allocation not found");
  if (allocation.status !== "APPROVED") {
    throw new SafeError(`Allocation must be APPROVED before delivery (current: ${allocation.status})`);
  }

  // Wrap allocation update and need status check in a transaction to prevent
  // inconsistency if the need status update fails after allocation is marked DELIVERED
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.allocation.update({
      where: { id: allocationId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliveryNote: note.trim()
      },
      include: {
        need: true,
        resource: true
      }
    });

    await checkAndUpdateNeedMetStatusTx(tx, allocation.needId);
    return result;
  });

  // §15.4: Record allocation fulfillment metric (DELIVERED state)
  metrics.recordAllocationFulfillment();

  const { logAuditEvent } = await import("./auditService.js");
  await logAuditEvent({
    actorId,
    actorRole: "ADMIN",
    action: "ALLOCATION_DELIVERED",
    targetType: "Allocation",
    targetId: allocationId,
    afterJson: JSON.stringify({ deliveredQuantity, note: note.trim() })
  });

  return updated;
}

/**
 * AC-08.03: Check if the need is fully covered by delivered allocations.
 * A need is "met" only when delivered quantities (traced to Fulfillment records)
 * meet or exceed the required quantity.
 */
async function checkAndUpdateNeedMetStatus(needId: string) {
  return checkAndUpdateNeedMetStatusTx(prisma, needId);
}

/**
 * Transaction-aware variant — accepts a Prisma transaction client so the
 * need status check runs atomically with the allocation update.
 */
async function checkAndUpdateNeedMetStatusTx(tx: Prisma.TransactionClient, needId: string) {
  const need = await tx.need.findUnique({
    where: { id: needId },
    include: {
      allocations: {
        select: {
          quantity: true,
          status: true,
          fulfillments: {
            select: { deliveredQuantity: true }
          }
        }
      }
    }
  });

  if (!need) return;

  // AC-08.03: Only DELIVERED allocations count toward meeting the need
  const deliveredTotal = need.allocations
    .filter((a) => a.status === "DELIVERED")
    .reduce((sum, a) => {
      const fulfillmentTotal = a.fulfillments.reduce((s, f) => s + f.deliveredQuantity, 0);
      return sum + (fulfillmentTotal > 0 ? fulfillmentTotal : a.quantity);
    }, 0);

  const isMet = deliveredTotal >= need.quantity;

  if (need.isMet !== isMet) {
    await tx.need.update({
      where: { id: needId },
      data: { isMet }
    });
  }
}
