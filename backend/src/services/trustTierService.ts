/**
 * Trust Tier Service
 *
 * Progressive trust system inspired by Discourse trust levels + Stack Exchange
 * reputation privileges + CORES RMS credential-based deployment.
 *
 * Tiers:
 *   REPORTER  (Tier 0) — submit reports, evidence, tasks with photo proof
 *   TRAINEE   (Tier 1) — opt into crises, submit flagged observations
 *   RESPONDER (Tier 2) — full update powers, can vouch for others
 *   VETERAN   (Tier 3) — co-approve trainee updates (community self-policing)
 *
 * Promotion rules:
 *   0 → 1: 30+ pts AND 1+ verified report, OR vouched by a Tier 2+
 *   1 → 2: 100+ pts AND 3+ approved field observations
 *   2 → 3: 500+ pts AND 10+ approved field observations
 */

import { TrustTier } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";

// ── Thresholds ──────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS = {
  TRAINEE_POINTS: 30,
  TRAINEE_REPORTS: 1,
  RESPONDER_POINTS: 100,
  RESPONDER_OBSERVATIONS: 3,
  VETERAN_POINTS: 500,
  VETERAN_OBSERVATIONS: 10,
} as const;

// Number of trainee observations that are auto-flagged before trust is earned
export const TRAINEE_FLAGGED_OBSERVATION_LIMIT = 3;

// ── Types ───────────────────────────────────────────────────────────────────

export type TrustTierLevel = TrustTier;

export type TrustTierInfo = {
  tier: TrustTier;
  points: number;
  approvedObservationCount: number;
  verifiedReportCount: number;
  hasVouch: boolean;
  // Progress to next tier (null if at max)
  nextTier: TrustTier | null;
  pointsNeeded: number | null;
  observationsNeeded: number | null;
  reportsNeeded: number | null;
};

export type VouchResult = {
  id: string;
  vouchedById: string;
  vouchedByName: string;
  vouchedForId: string;
  vouchedForName: string;
  reason: string;
  createdAt: string;
};

// ── Core functions ──────────────────────────────────────────────────────────

/**
 * Get the trust tier info for a volunteer, including progress to the next tier.
 */
export async function getTrustTierInfo(userId: string): Promise<TrustTierInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trustTier: true,
      totalPoints: true,
      role: true,
    },
  });

  if (!user || user.role !== "VOLUNTEER") {
    return {
      tier: "REPORTER",
      points: 0,
      approvedObservationCount: 0,
      verifiedReportCount: 0,
      hasVouch: false,
      nextTier: null,
      pointsNeeded: null,
      observationsNeeded: null,
      reportsNeeded: null,
    };
  }

  const [approvedObservationCount, verifiedReportCount, vouch] = await Promise.all([
    countApprovedObservations(userId),
    countVerifiedReports(userId),
    prisma.vouch.findUnique({
      where: { vouchedForId: userId },
      select: { id: true },
    }),
  ]);

  const hasVouch = Boolean(vouch);

  // Determine next tier and requirements
  let nextTier: TrustTier | null = null;
  let pointsNeeded: number | null = null;
  let observationsNeeded: number | null = null;
  let reportsNeeded: number | null = null;

  if (user.trustTier === "REPORTER") {
    nextTier = "TRAINEE";
    pointsNeeded = Math.max(0, TIER_THRESHOLDS.TRAINEE_POINTS - user.totalPoints);
    reportsNeeded = Math.max(0, TIER_THRESHOLDS.TRAINEE_REPORTS - verifiedReportCount);
    // If vouched, no points/reports needed
    if (hasVouch) {
      pointsNeeded = 0;
      reportsNeeded = 0;
    }
  } else if (user.trustTier === "TRAINEE") {
    nextTier = "RESPONDER";
    pointsNeeded = Math.max(0, TIER_THRESHOLDS.RESPONDER_POINTS - user.totalPoints);
    observationsNeeded = Math.max(0, TIER_THRESHOLDS.RESPONDER_OBSERVATIONS - approvedObservationCount);
  } else if (user.trustTier === "RESPONDER") {
    nextTier = "VETERAN";
    pointsNeeded = Math.max(0, TIER_THRESHOLDS.VETERAN_POINTS - user.totalPoints);
    observationsNeeded = Math.max(0, TIER_THRESHOLDS.VETERAN_OBSERVATIONS - approvedObservationCount);
  }

  return {
    tier: user.trustTier,
    points: user.totalPoints,
    approvedObservationCount,
    verifiedReportCount,
    hasVouch,
    nextTier,
    pointsNeeded,
    observationsNeeded,
    reportsNeeded,
  };
}

/**
 * Get the current trust tier for a volunteer (lightweight, no progress info).
 */
export async function getTrustTier(userId: string): Promise<TrustTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustTier: true, role: true },
  });

  if (!user || user.role !== "VOLUNTEER") {
    return "REPORTER";
  }

  return user.trustTier;
}

/**
 * Count approved FIELD_OBSERVATION updates by a volunteer.
 * "Approved" means the update was flagged and then approved by an admin/veteran
 * (isFlagged = false, dismissedById = the approver, verificationStatus = ADMIN_CONFIRMED).
 */
export async function countApprovedObservations(userId: string): Promise<number> {
  // An approved observation is one that was originally flagged (trainee submission)
  // and then approved by an admin. We track this via verificationStatus = ADMIN_CONFIRMED
  // on FIELD_OBSERVATION updates.
  return prisma.crisisEventUpdate.count({
    where: {
      updaterId: userId,
      updateType: "FIELD_OBSERVATION",
      verificationStatus: "ADMIN_CONFIRMED",
      dismissedAt: { not: null },
    },
  });
}

/**
 * Count verified/published incident reports by a volunteer.
 */
export async function countVerifiedReports(userId: string): Promise<number> {
  return prisma.incidentReport.count({
    where: {
      reporterId: userId,
      status: "PUBLISHED",
    },
  });
}

/**
 * Check and promote a volunteer's trust tier based on their current stats.
 * Called after points are awarded, observations are approved, or a vouch is created.
 * Returns the new tier if promoted, or the current tier if no change.
 */
export async function checkAndPromoteTrustTier(userId: string): Promise<TrustTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustTier: true, role: true, totalPoints: true },
  });

  if (!user || user.role !== "VOLUNTEER") return "REPORTER";

  const [approvedObs, verifiedReports, vouch] = await Promise.all([
    countApprovedObservations(userId),
    countVerifiedReports(userId),
    prisma.vouch.findUnique({
      where: { vouchedForId: userId },
      select: { id: true },
    }),
  ]);

  const hasVouch = Boolean(vouch);
  let newTier = user.trustTier;

  // Check promotions in order (can promote multiple levels at once)
  if (newTier === "REPORTER") {
    // 0 → 1: 30+ pts AND 1+ verified report, OR vouched
    if (hasVouch || (user.totalPoints >= TIER_THRESHOLDS.TRAINEE_POINTS && verifiedReports >= TIER_THRESHOLDS.TRAINEE_REPORTS)) {
      newTier = "TRAINEE";
    }
  }

  if (newTier === "TRAINEE") {
    // 1 → 2: 100+ pts AND 3+ approved observations
    if (user.totalPoints >= TIER_THRESHOLDS.RESPONDER_POINTS && approvedObs >= TIER_THRESHOLDS.RESPONDER_OBSERVATIONS) {
      newTier = "RESPONDER";
    }
  }

  if (newTier === "RESPONDER") {
    // 2 → 3: 500+ pts AND 10+ approved observations
    if (user.totalPoints >= TIER_THRESHOLDS.VETERAN_POINTS && approvedObs >= TIER_THRESHOLDS.VETERAN_OBSERVATIONS) {
      newTier = "VETERAN";
    }
  }

  if (newTier !== user.trustTier) {
    await prisma.user.update({
      where: { id: userId },
      data: { trustTier: newTier },
    });

    // Also create/update the ResponderProfile for backward compatibility
    // (some code still checks responderProfile for suspended status)
    if (newTier === "RESPONDER" || newTier === "VETERAN") {
      const existing = await prisma.responderProfile.findUnique({
        where: { userId },
        select: { id: true, approvalStatus: true },
      });

      if (!existing) {
        await prisma.responderProfile.create({
          data: {
            userId,
            approvalStatus: "APPROVED",
            reviewedAt: new Date(),
            reviewedById: null,
          },
        });
      } else if (existing.approvalStatus !== "APPROVED") {
        await prisma.responderProfile.update({
          where: { userId },
          data: {
            approvalStatus: "APPROVED",
            reviewedAt: new Date(),
            reviewedById: null,
            rejectionReason: null,
          },
        });
      }
    }

    // Send a promotion notification to the volunteer
    const tierMessages: Record<TrustTier, string> = {
      REPORTER: "",
      TRAINEE: "You've been promoted to Trainee! You can now opt into crises and submit field observations.",
      RESPONDER: "You've been promoted to Responder! You now have full update powers and can vouch for other volunteers.",
      VETERAN: "You've been promoted to Veteran! You can co-approve trainee updates and help police the community.",
    };

    const msg = tierMessages[newTier];
    if (msg) {
      await prisma.notification
        .create({
          data: {
            userId,
            title: `Trust Tier Promoted: ${newTier}`,
            body: msg,
            type: "TRUST_TIER_PROMOTED",
          },
        })
        .catch(() => null); // non-critical — don't fail the promotion if notification fails
    }

    console.log(`[trust-tier] Volunteer ${userId} promoted from ${user.trustTier} to ${newTier}`);
  }

  return newTier;
}

/**
 * Check if a volunteer can perform a specific crisis update action.
 * Returns true if allowed, throws SafeError if not.
 */
export async function assertCanSubmitUpdateType(
  userId: string,
  updateType: string,
  targetStatus: string
): Promise<{ actorRole: "ADMIN" | "VOLUNTEER"; tier: TrustTier }> {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isBanned: true, trustTier: true },
  });

  if (!actor || actor.isBanned) {
    throw new SafeError("Account is not allowed to publish field intelligence");
  }

  if (updateType === "RESPONDER_STATUS") {
    throw new SafeError("Responder timeline entries are generated automatically");
  }

  if (actor.role === "ADMIN") {
    return { actorRole: "ADMIN", tier: "VETERAN" };
  }

  if (actor.role !== "VOLUNTEER") {
    throw new SafeError("Only admins or active crisis responders can publish field intelligence");
  }

  if (updateType === "ADMIN_CORRECTION") {
    throw new SafeError("Only admins can publish correction notes");
  }

  if (targetStatus === "CLOSED") {
    throw new SafeError("Only admins can close a crisis");
  }

  const tier = actor.trustTier;

  // Tier 0 (Reporter) cannot submit any crisis updates — they need to be Tier 1+
  if (tier === "REPORTER") {
    throw new SafeError(
      "You need to be a Trainee or higher to submit crisis updates. Earn 30 points or get vouched by an approved responder to opt into crises."
    );
  }

  // Tier 1 (Trainee) can only submit FIELD_OBSERVATION and RESOURCE_NEED
  if (tier === "TRAINEE") {
    const allowedTypes = ["FIELD_OBSERVATION", "RESOURCE_NEED"];
    if (!allowedTypes.includes(updateType)) {
      throw new SafeError(
        "As a Trainee, you can only submit field observations and resource needs. Earn 100 points and 3 approved observations to unlock full responder status."
      );
    }
  }

  // Tier 2 (Responder) and Tier 3 (Veteran) can submit all types (except admin-only)

  return { actorRole: "VOLUNTEER", tier };
}

/**
 * Determine if a volunteer's update should be auto-flagged for review.
 * Trainees: first N observations are flagged, then auto-approved (trust earned through track record).
 * Responders/Veterans: not flagged (unless conflict detection triggers).
 */
export async function shouldFlagUpdate(
  userId: string,
  _updateType: string,
  tier: TrustTier
): Promise<boolean> {
  if (tier === "REPORTER") {
    // Should never reach here — assertCanSubmitUpdateType blocks REPORTER
    return true;
  }

  if (tier === "TRAINEE") {
    // First N observations are flagged, then auto-approved
    const approvedCount = await countApprovedObservations(userId);
    return approvedCount < TRAINEE_FLAGGED_OBSERVATION_LIMIT;
  }

  // Responder and Veteran: not flagged
  return false;
}

/**
 * Check if a volunteer is required to provide photo evidence for task logs.
 * Tier 0 and Tier 1 must provide evidence. Tier 2+ are trusted.
 */
export async function requiresTaskEvidence(userId: string): Promise<boolean> {
  const tier = await getTrustTier(userId);
  return tier === "REPORTER" || tier === "TRAINEE";
}

// ── Vouching ────────────────────────────────────────────────────────────────

/**
 * Create a vouch. Only Tier 2 (Responder) and Tier 3 (Veteran) volunteers can vouch.
 * Vouching fast-tracks the vouched-for volunteer to Trainee (Tier 1).
 */
export async function createVouch(
  vouchedById: string,
  vouchedForId: string,
  reason: string,
  crisisEventId?: string
): Promise<VouchResult> {
  if (vouchedById === vouchedForId) {
    throw new SafeError("You cannot vouch for yourself");
  }

  if (!reason || reason.trim().length < 10) {
    throw new SafeError("Please provide a reason (at least 10 characters) for vouching");
  }

  const [vouchedBy, vouchedFor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: vouchedById },
      select: { id: true, fullName: true, role: true, trustTier: true, isBanned: true },
    }),
    prisma.user.findUnique({
      where: { id: vouchedForId },
      select: { id: true, fullName: true, role: true, trustTier: true, isBanned: true },
    }),
  ]);

  if (!vouchedBy) throw new SafeError("Voucher not found");
  if (!vouchedFor) throw new SafeError("Volunteer not found");
  if (vouchedBy.isBanned) throw new SafeError("Your account is banned");
  if (vouchedFor.isBanned) throw new SafeError("Cannot vouch for a banned volunteer");
  if (vouchedFor.role !== "VOLUNTEER") throw new SafeError("You can only vouch for volunteers");

  // Only Tier 2+ can vouch
  if (vouchedBy.role !== "ADMIN" && (vouchedBy.trustTier !== "RESPONDER" && vouchedBy.trustTier !== "VETERAN")) {
    throw new SafeError("Only approved Responders (Tier 2+) or Veterans can vouch for other volunteers");
  }

  // Check if already vouched
  const existing = await prisma.vouch.findUnique({
    where: { vouchedForId },
    select: { id: true },
  });

  if (existing) {
    throw new SafeError("This volunteer has already been vouched for");
  }

  // Create the vouch
  const vouch = await prisma.vouch.create({
    data: {
      vouchedById,
      vouchedForId,
      reason: reason.trim(),
      crisisEventId: crisisEventId ?? null,
    },
    include: {
      vouchedBy: { select: { fullName: true } },
      vouchedFor: { select: { fullName: true } },
    },
  });

  // Promote the vouched-for volunteer to Trainee if they're currently a Reporter
  if (vouchedFor.trustTier === "REPORTER") {
    await prisma.user.update({
      where: { id: vouchedForId },
      data: { trustTier: "TRAINEE" },
    });
    console.log(`[trust-tier] Volunteer ${vouchedForId} promoted to TRAINEE via vouch from ${vouchedById}`);
  }

  // Create a notification for the vouched-for volunteer
  await prisma.notification.create({
    data: {
      userId: vouchedForId,
      title: "You've been vouched for!",
      body: `${vouchedBy.fullName} vouched for you. You can now opt into crises and submit field observations as a Trainee.`,
      type: "VOUCH_RECEIVED",
    },
  }).catch(() => null); // non-critical

  return {
    id: vouch.id,
    vouchedById: vouch.vouchedById,
    vouchedByName: vouch.vouchedBy.fullName,
    vouchedForId: vouch.vouchedForId,
    vouchedForName: vouch.vouchedFor.fullName,
    reason: vouch.reason,
    createdAt: vouch.createdAt.toISOString(),
  };
}

/**
 * Get vouches received by a volunteer.
 */
export async function getVouchesReceived(userId: string): Promise<VouchResult[]> {
  const vouches = await prisma.vouch.findMany({
    where: { vouchedForId: userId },
    include: {
      vouchedBy: { select: { fullName: true } },
      vouchedFor: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return vouches.map((v) => ({
    id: v.id,
    vouchedById: v.vouchedById,
    vouchedByName: v.vouchedBy.fullName,
    vouchedForId: v.vouchedForId,
    vouchedForName: v.vouchedFor.fullName,
    reason: v.reason,
    createdAt: v.createdAt.toISOString(),
  }));
}

/**
 * Get vouches given by a volunteer.
 */
export async function getVouchesGiven(userId: string): Promise<VouchResult[]> {
  const vouches = await prisma.vouch.findMany({
    where: { vouchedById: userId },
    include: {
      vouchedBy: { select: { fullName: true } },
      vouchedFor: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return vouches.map((v) => ({
    id: v.id,
    vouchedById: v.vouchedById,
    vouchedByName: v.vouchedBy.fullName,
    vouchedForId: v.vouchedForId,
    vouchedForName: v.vouchedFor.fullName,
    reason: v.reason,
    createdAt: v.createdAt.toISOString(),
  }));
}

/**
 * Sync trust tiers for all volunteers on startup.
 * This fixes the seed data disconnect where volunteers had points but no tier.
 */
export async function syncAllTrustTiers(): Promise<void> {
  const volunteers = await prisma.user.findMany({
    where: { role: "VOLUNTEER" },
    select: { id: true },
  });

  let promoted = 0;
  for (const v of volunteers) {
    const newTier = await checkAndPromoteTrustTier(v.id);
    const user = await prisma.user.findUnique({
      where: { id: v.id },
      select: { trustTier: true },
    });
    if (user && newTier !== "REPORTER" && newTier === user.trustTier) {
      promoted++;
    }
  }

  console.log(`[trust-tier] Synced ${volunteers.length} volunteers, ${promoted} promoted`);
}
