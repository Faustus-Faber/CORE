/**
 * Responder approval service.
 *
 * FR-01: Volunteers must be approved by a coordinator/admin before they can
 * respond to crises. The ResponderProfile model tracks the approval lifecycle:
 *   APPLICANT → UNDER_REVIEW → APPROVED
 *                          └→ REJECTED
 *   APPROVED → SUSPENDED → APPROVED
 *
 * Only APPROVED responders can opt into crisis events.
 */

import type { ResponderApprovalStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";

const VALID_TRANSITIONS: Record<ResponderApprovalStatus, ResponderApprovalStatus[]> = {
  APPLICANT: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
  REJECTED: ["UNDER_REVIEW"],
};

export type ResponderApprovalResult = {
  userId: string;
  fullName: string;
  approvalStatus: ResponderApprovalStatus;
  reviewedAt: string | null;
  reviewedById: string | null;
};

function toResult(profile: {
  userId: string;
  approvalStatus: ResponderApprovalStatus;
  reviewedAt: Date | null;
  reviewedById: string | null;
  user: { fullName: string };
}): ResponderApprovalResult {
  return {
    userId: profile.userId,
    fullName: profile.user.fullName,
    approvalStatus: profile.approvalStatus,
    reviewedAt: profile.reviewedAt ? profile.reviewedAt.toISOString() : null,
    reviewedById: profile.reviewedById,
  };
}

/**
 * List all responder profiles with optional status filter.
 */
export async function listResponderProfiles(
  statusFilter?: ResponderApprovalStatus
): Promise<ResponderApprovalResult[]> {
  const profiles = await prisma.responderProfile.findMany({
    where: statusFilter ? { approvalStatus: statusFilter } : {},
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return profiles.map(toResult);
}

/**
 * Transition a responder's approval status.
 * Called by admin/coordinator to approve, reject, suspend, or review.
 */
/**
 * @deprecated Manual approval has been removed. Volunteers are auto-approved
 * when they reach 100+ points via checkAndAutoApproveResponder() in
 * timesheetService.ts. This function is kept only for the admin suspend/reinstate
 * workflow (safety valve for problematic volunteers).
 */
export async function transitionResponderApproval(
  userId: string,
  targetStatus: ResponderApprovalStatus,
  reviewedBy: string,
  rejectionReason?: string
): Promise<ResponderApprovalResult> {
  // Block manual APPROVE from APPLICANT/UNDER_REVIEW/REJECTED — only auto-approval via points is allowed.
  // APPROVED is only allowed here when reinstating from SUSPENDED.
  if (targetStatus === "APPROVED") {
    const profile = await prisma.responderProfile.findUnique({
      where: { userId },
      select: { approvalStatus: true, user: { select: { fullName: true } } },
    });
    if (!profile) throw new SafeError("Responder profile not found");
    if (profile.approvalStatus !== "SUSPENDED") {
      throw new SafeError(
        "Manual approval is no longer available. Volunteers are auto-approved at 100+ verified points."
      );
    }
    // Fall through to the normal transition (SUSPENDED → APPROVED is valid)
  } else if (targetStatus === "REJECTED") {
    throw new SafeError(
      "Manual rejection is no longer available. Volunteers are auto-approved at 100+ verified points."
    );
  }

  const profile = await prisma.responderProfile.findUnique({
    where: { userId },
    include: { user: { select: { fullName: true } } },
  });

  if (!profile) {
    throw new SafeError("Responder profile not found");
  }

  const currentStatus = profile.approvalStatus;
  if (currentStatus === targetStatus) {
    return toResult(profile);
  }

  if (!VALID_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
    throw new SafeError(
      `Invalid approval transition: ${currentStatus} → ${targetStatus}`
    );
  }

  const updated = await prisma.responderProfile.update({
    where: { userId },
    data: {
      approvalStatus: targetStatus,
      reviewedById: reviewedBy,
      reviewedAt: new Date(),
      ...(rejectionReason ? { rejectionReason } : {}),
    },
    include: { user: { select: { fullName: true } } },
  });

  // ── Sync trust tier with suspension status ──────────────────────────────
  // SUSPENDED → demote to REPORTER (strips update powers, vouching, etc.)
  // APPROVED (reinstate) → re-run promotion check to restore earned tier
  try {
    if (targetStatus === "SUSPENDED") {
      await prisma.user.update({
        where: { id: userId },
        data: { trustTier: "REPORTER" },
      });
      await prisma.notification
        .create({
          data: {
            userId,
            title: "Account Suspended",
            body: "Your responder status has been suspended by an admin. Your trust tier has been reset to Reporter. Contact support if you believe this is an error.",
            type: "TRUST_TIER_PROMOTED",
          },
        })
        .catch(() => null);
      console.log(`[responder-approval] Volunteer ${userId} suspended → demoted to REPORTER`);
    } else if (targetStatus === "APPROVED") {
      // Re-run the promotion check to restore the volunteer to their earned tier
      const { checkAndPromoteTrustTier } = await import("./trustTierService.js");
      await checkAndPromoteTrustTier(userId);
      console.log(`[responder-approval] Volunteer ${userId} reinstated → trust tier re-evaluated`);
    }
  } catch (err) {
    console.error("[responder-approval] Failed to sync trust tier:", err);
  }

  return toResult(updated);
}

/**
 * Check if a volunteer is approved to respond to crises.
 * Returns true only if they have a responder profile with APPROVED status.
 */
export async function isResponderApproved(userId: string): Promise<boolean> {
  const profile = await prisma.responderProfile.findUnique({
    where: { userId },
    select: { approvalStatus: true },
  });

  return profile?.approvalStatus === "APPROVED";
}
