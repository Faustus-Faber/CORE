/**
 * Assignment State Machine — replaces unsafe self-opt-in volunteer dispatch
 * with a coordinator-driven assignment workflow.
 *
 * States: PROPOSED → OFFERED → ACCEPTED → EN_ROUTE → ON_SITE → COMPLETED
 * Terminal: DECLINED, CANCELLED, EXPIRED
 */

import type { AssignmentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";

// Valid state transitions
const VALID_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  PROPOSED: ["OFFERED", "CANCELLED"],
  OFFERED: ["ACCEPTED", "DECLINED", "EXPIRED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ON_SITE", "CANCELLED"],
  ON_SITE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
  EXPIRED: []
};

export type AssignmentWithRelations = Awaited<ReturnType<typeof prisma.assignment.findUnique>> & {
  id: string;
  status: AssignmentStatus;
  volunteerId: string;
  crisisEventId: string;
  volunteer: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    skills: string[];
    location: string;
  };
  crisisEvent: {
    id: string;
    title: string;
    incidentType: string;
    severityLevel: string;
    locationText: string;
    latitude: number | null;
    longitude: number | null;
  };
  need: {
    id: string;
    needType: string;
    description: string;
    quantity: number;
    unit: string;
  } | null;
  proposedBy: {
    id: string;
    fullName: string;
  };
};

function validateTransition(from: AssignmentStatus, to: AssignmentStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new SafeError(`Invalid transition from ${from} to ${to}. Valid: ${VALID_TRANSITIONS[from]?.join(", ") ?? "none"}`);
  }
}

/**
 * Propose a new assignment (coordinator proposes to a volunteer).
 */
export async function proposeAssignment(
  crisisEventId: string,
  volunteerId: string,
  proposedById: string,
  needId?: string
): Promise<AssignmentWithRelations> {
  const [crisis, volunteer] = await Promise.all([
    prisma.crisisEvent.findUnique({
      where: { id: crisisEventId },
      select: { id: true, status: true, title: true }
    }),
    prisma.user.findUnique({
      where: { id: volunteerId },
      select: { id: true, role: true, isBanned: true, skills: true, availability: true }
    })
  ]);

  if (!crisis) throw new SafeError("Crisis event not found");
  if (!volunteer) throw new SafeError("Volunteer not found");
  if (volunteer.role !== "VOLUNTEER") throw new SafeError("User is not a volunteer");
  if (volunteer.isBanned) throw new SafeError("Volunteer is banned");

  // Return 409 if volunteer already has an active assignment for this crisis
  // Wrap check+create in a transaction to prevent race condition
  const assignment = await prisma.$transaction(async (tx) => {
    const existing = await tx.assignment.findFirst({
      where: {
        crisisEventId,
        volunteerId,
        status: { notIn: ["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"] }
      }
    });

    if (existing) {
      throw new SafeError(`Volunteer already has active assignment (status: ${existing.status})`);
    }

    return tx.assignment.create({
      data: {
        crisisEventId,
        needId: needId ?? null,
        volunteerId,
        proposedById,
        status: "PROPOSED"
      },
      include: {
        crisisEvent: true,
        need: true,
        volunteer: {
          select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true }
        },
        proposedBy: { select: { id: true, fullName: true } }
      }
    });
  });

  return assignment as AssignmentWithRelations;
}

/**
 * Offer the assignment to the volunteer (PROPOSED → OFFERED).
 */
export async function offerAssignment(id: string, actorId: string): Promise<AssignmentWithRelations> {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      crisisEvent: true,
      need: true,
      volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
      proposedBy: { select: { id: true, fullName: true } }
    }
  });

  if (!assignment) throw new SafeError("Assignment not found");
  validateTransition(assignment.status, "OFFERED");

  return prisma.assignment.update({
    where: { id },
    data: { status: "OFFERED", offeredAt: new Date() },
    include: {
      crisisEvent: true,
      need: true,
      volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
      proposedBy: { select: { id: true, fullName: true } }
    }
  }) as Promise<AssignmentWithRelations>;
}

/**
 * Volunteer accepts the assignment (OFFERED → ACCEPTED).
 */
export async function acceptAssignment(id: string, volunteerId: string): Promise<AssignmentWithRelations> {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      crisisEvent: true,
      need: true,
      volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
      proposedBy: { select: { id: true, fullName: true } }
    }
  });

  if (!assignment) throw new SafeError("Assignment not found");
  if (assignment.volunteerId !== volunteerId) throw new SafeError("Not your assignment");
  validateTransition(assignment.status, "ACCEPTED");

  return prisma.assignment.update({
    where: { id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
    include: {
      crisisEvent: true,
      need: true,
      volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
      proposedBy: { select: { id: true, fullName: true } }
    }
  }) as Promise<AssignmentWithRelations>;
}

/**
 * Update assignment status with proper state validation.
 */
export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus,
  actorId: string,
  note?: string
): Promise<AssignmentWithRelations> {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { crisisEvent: true, need: true, volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } }, proposedBy: { select: { id: true, fullName: true } } }
  });

  if (!assignment) throw new SafeError("Assignment not found");

  // Verify the actor is the assigned volunteer or an admin
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true }
  });
  if (!actor) throw new SafeError("Actor not found");
  if (actor.role !== "ADMIN" && assignment.volunteerId !== actorId) {
    throw new SafeError("You can only transition your own assignments");
  }

  validateTransition(assignment.status, status);

  const data: Record<string, any> = { status };
  if (status === "COMPLETED") data.completedAt = new Date();
  if (status === "DECLINED") data.declinedAt = new Date();
  if (status === "CANCELLED") data.cancelledAt = new Date();
  if (note) data.outcomeNote = note.trim();

  return prisma.assignment.update({
    where: { id },
    data,
    include: {
      crisisEvent: true,
      need: true,
      volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
      proposedBy: { select: { id: true, fullName: true } }
    }
  }) as Promise<AssignmentWithRelations>;
}

/**
 * Accept a completed assignment outcome (coordinator verifies completion).
 */
export async function approveAssignmentOutcome(
  id: string,
  coordinatorId: string
): Promise<AssignmentWithRelations> {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id },
      select: { status: true, outcomeApproved: true }
    });

    if (!assignment) throw new SafeError("Assignment not found");
    if (assignment.status !== "COMPLETED") throw new SafeError("Assignment must be COMPLETED before approving outcome");
    if (assignment.outcomeApproved === true) throw new SafeError("Assignment outcome has already been approved");

    return tx.assignment.update({
      where: { id },
      data: { outcomeApproved: true },
      include: {
        crisisEvent: true, need: true,
        volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
        proposedBy: { select: { id: true, fullName: true } }
      }
    }) as Promise<AssignmentWithRelations>;
  });
}

/**
 * Get all assignments for a crisis.
 */
export async function getAssignmentsForCrisis(crisisEventId: string) {
  return prisma.assignment.findMany({
    where: { crisisEventId },
    take: 200,
    include: {
      volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
      need: { select: { id: true, needType: true, description: true, quantity: true, unit: true } },
      proposedBy: { select: { id: true, fullName: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * Get assignments for a specific volunteer.
 */
export async function getAssignmentsForVolunteer(volunteerId: string) {
  return prisma.assignment.findMany({
    where: { volunteerId, status: { notIn: ["DECLINED", "CANCELLED", "EXPIRED"] } },
    take: 100,
    include: {
      crisisEvent: { select: { id: true, title: true, incidentType: true, severityLevel: true, locationText: true } },
      need: { select: { id: true, needType: true, description: true } },
      proposedBy: { select: { id: true, fullName: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * Expire stale OFFERED assignments (called by the background scheduler).
 */
export async function expireStaleOffers(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h old offers

  const result = await prisma.assignment.updateMany({
    where: {
      status: "OFFERED",
      offeredAt: { lt: cutoff }
    },
    data: { status: "EXPIRED" }
  });

  return result.count;
}

// ── AC-06.04: Dispatch Recommendation with Constraint Explanations ──────────

export interface DispatchRecommendation {
  volunteerId: string;
  volunteerName: string;
  skills: string[];
  location: string;
  distanceKm: number | null;
  availability: string | null;
  matchScore: number;
  matchReasons: string[];
  constraints: {
    skillsMatched: string[];
    skillsMissing: string[];
    isAvailable: boolean;
    isBanned: boolean;
    hasActiveAssignment: boolean;
    distanceOk: boolean;
  };
}

/**
 * AC-06.04: Recommend volunteers for a crisis event with full constraint explanations.
 * Explains WHY each volunteer was recommended (skills match, distance, availability).
 */
export async function recommendVolunteersForCrisis(
  crisisEventId: string,
  options?: { requiredSkills?: string[]; maxDistanceKm?: number; limit?: number }
): Promise<DispatchRecommendation[]> {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true, incidentType: true, latitude: true, longitude: true, locationText: true }
  });
  if (!crisis) throw new SafeError("Crisis event not found");

  const requiredSkills = options?.requiredSkills ?? [];
  const maxDistanceKm = options?.maxDistanceKm ?? 50;
  const limit = options?.limit ?? 20;

  // Fetch active, non-banned volunteers (capped for in-memory scoring)
  const volunteers = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      isBanned: false,
    },
    select: {
      id: true,
      fullName: true,
      skills: true,
      location: true,
      availability: true,
      latitude: true,
      longitude: true,
    },
    take: 500,
  });

  // Fetch volunteers with active assignments for this crisis
  const activeAssignments = await prisma.assignment.findMany({
    where: {
      crisisEventId,
      status: { notIn: ["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"] },
    },
    select: { volunteerId: true },
    take: 1000,
  });
  const busyVolunteerIds = new Set(activeAssignments.map((a) => a.volunteerId));

  const { haversineDistanceKm } = await import("../utils/geo.js");

  const recommendations: DispatchRecommendation[] = [];

  for (const v of volunteers) {
    const skillsMatched = requiredSkills.filter((s) =>
      v.skills.some((vs) => vs.toLowerCase() === s.toLowerCase())
    );
    const skillsMissing = requiredSkills.filter(
      (s) => !v.skills.some((vs) => vs.toLowerCase() === s.toLowerCase())
    );

    const distanceKm =
      crisis.latitude != null && crisis.longitude != null &&
      v.latitude != null && v.longitude != null
        ? haversineDistanceKm(crisis.latitude, crisis.longitude, v.latitude, v.longitude)
        : null;

    const distanceOk = distanceKm == null || distanceKm <= maxDistanceKm;
    const isAvailable = v.availability === "AVAILABLE" || v.availability === "FLEXIBLE";
    const hasActiveAssignment = busyVolunteerIds.has(v.id);

    // Build match reasons — explain WHY this volunteer is recommended
    const matchReasons: string[] = [];
    if (skillsMatched.length > 0) {
      matchReasons.push(`Skills matched: ${skillsMatched.join(", ")}`);
    }
    if (distanceKm != null && distanceOk) {
      matchReasons.push(`Within range: ${distanceKm.toFixed(1)}km away (limit: ${maxDistanceKm}km)`);
    }
    if (isAvailable) {
      matchReasons.push(`Available: ${v.availability}`);
    }
    if (skillsMissing.length > 0) {
      matchReasons.push(`Missing skills: ${skillsMissing.join(", ")}`);
    }
    if (!isAvailable) {
      matchReasons.push(`Not available: ${v.availability}`);
    }
    if (hasActiveAssignment) {
      matchReasons.push(`Already assigned to this crisis`);
    }
    if (distanceKm != null && !distanceOk) {
      matchReasons.push(`Out of range: ${distanceKm.toFixed(1)}km (limit: ${maxDistanceKm}km)`);
    }

    // Compute match score (0-100)
    let matchScore = 0;
    if (skillsMatched.length === requiredSkills.length && requiredSkills.length > 0) {
      matchScore += 40;
    } else if (skillsMatched.length > 0) {
      matchScore += 20 * (skillsMatched.length / requiredSkills.length);
    }
    if (distanceOk) matchScore += 25;
    if (isAvailable) matchScore += 25;
    if (!hasActiveAssignment) matchScore += 10;
    matchScore = Math.min(100, Math.round(matchScore));

    recommendations.push({
      volunteerId: v.id,
      volunteerName: v.fullName,
      skills: v.skills,
      location: v.location,
      distanceKm,
      availability: v.availability,
      matchScore,
      matchReasons,
      constraints: {
        skillsMatched,
        skillsMissing,
        isAvailable,
        isBanned: false,
        hasActiveAssignment,
        distanceOk,
      },
    });
  }

  // Sort by match score descending, then by distance ascending
  recommendations.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return 0;
  });

  return recommendations.slice(0, limit);
}
