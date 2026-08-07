/**
 * Audit Event Service — append-only, redacted log of consequential actions.
 */

import { prisma } from "../lib/prisma.js";

export type AuditActionInput = {
  actorId?: string;
  actorRole?: string;
  action: string;           // e.g., "CLAIM_ACCEPTED", "ASSIGNMENT_OFFERED"
  targetType: string;       // e.g., "Claim", "Assignment", "CrisisEvent"
  targetId?: string;
  reason?: string;
  beforeJson?: string;
  afterJson?: string;
  requestId?: string;
};

export async function logAuditEvent(input: AuditActionInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        reason: input.reason ?? null,
        beforeJson: input.beforeJson ?? null,
        afterJson: input.afterJson ?? null,
        requestId: input.requestId ?? null
      }
    });
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
    // Don't throw — audit failure should not crash the request
  }
}

export async function getAuditTrail(
  targetType: string,
  targetId: string,
  limit = 50
) {
  return prisma.auditEvent.findMany({
    where: {
      targetType,
      targetId
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, fullName: true } }
    }
  });
}

export async function getActorAuditTrail(
  actorId: string,
  limit = 50
) {
  return prisma.auditEvent.findMany({
    where: { actorId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
