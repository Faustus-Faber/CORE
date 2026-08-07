import type { CrisisEventStatus, CrisisResponderStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { refreshSituationSummary } from "./crisisUpdateService.js";
import { getTrustTier } from "./trustTierService.js";
import { SafeError } from "../utils/SafeError.js";

const ACTIVE_RESPONDER_STATUSES: CrisisResponderStatus[] = [
  "RESPONDING",
  "EN_ROUTE",
  "ON_SITE",
  "COMPLETED"
];

const STATUS_FLOW: Record<CrisisResponderStatus, CrisisResponderStatus[]> = {
  RESPONDING: ["EN_ROUTE", "ON_SITE", "COMPLETED", "UNAVAILABLE"],
  EN_ROUTE: ["ON_SITE", "COMPLETED", "UNAVAILABLE"],
  ON_SITE: ["COMPLETED", "UNAVAILABLE"],
  COMPLETED: ["RESPONDING", "UNAVAILABLE"],
  UNAVAILABLE: ["RESPONDING"]
};

export type CrisisResponderSummary = {
  id: string;
  volunteerId: string;
  volunteerName: string;
  avatarUrl: string | null;
  skills: string[];
  location: string;
  status: CrisisResponderStatus;
  trustTier: string;
  observationCount: number;
  resourceNeedCount: number;
  optedInAt: string;
  lastStatusAt: string;
  updatedAt: string;
};

function toSummary(
  record: {
    id: string;
    volunteerId: string;
    status: CrisisResponderStatus;
    optedInAt: Date;
    lastStatusAt: Date;
    updatedAt: Date;
    volunteer: {
      fullName: string;
      avatarUrl: string | null;
      skills: string[];
      location: string;
      trustTier: string;
    };
  },
  counts: { observationCount: number; resourceNeedCount: number }
): CrisisResponderSummary {
  return {
    id: record.id,
    volunteerId: record.volunteerId,
    volunteerName: record.volunteer.fullName,
    avatarUrl: record.volunteer.avatarUrl,
    skills: record.volunteer.skills,
    location: record.volunteer.location,
    status: record.status,
    trustTier: record.volunteer.trustTier,
    observationCount: counts.observationCount,
    resourceNeedCount: counts.resourceNeedCount,
    optedInAt: record.optedInAt.toISOString(),
    lastStatusAt: record.lastStatusAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

async function assertCrisisExists(
  crisisEventId: string
): Promise<{ id: string; status: CrisisEventStatus }> {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true, status: true }
  });

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  // P1-6: Prevent responder updates on resolved or closed crises
  if (crisis.status === "RESOLVED" || crisis.status === "CLOSED") {
    throw new SafeError("Cannot update responder status on a resolved or closed crisis");
  }

  return crisis;
}

async function assertVolunteer(volunteerId: string): Promise<void> {
  const volunteer = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: { role: true, isBanned: true }
  });

  if (!volunteer || volunteer.role !== "VOLUNTEER") {
    throw new SafeError("Volunteer account required");
  }

  if (volunteer.isBanned) {
    throw new SafeError("Volunteer account is banned");
  }
}

function assertStatusTransition(
  previousStatus: CrisisResponderStatus,
  nextStatus: CrisisResponderStatus
) {
  if (previousStatus === nextStatus) return;
  if (!STATUS_FLOW[previousStatus].includes(nextStatus)) {
    throw new SafeError(
      `Invalid responder status transition: ${previousStatus} -> ${nextStatus}`
    );
  }
}

function buildResponderTimelineNote(
  volunteerName: string,
  previousStatus: CrisisResponderStatus | null,
  nextStatus: CrisisResponderStatus
): string {
  const nextLabel = nextStatus.replace(/_/g, " ").toLowerCase();

  if (!previousStatus) {
    return `${volunteerName} opted in and is now ${nextLabel}.`;
  }

  const previousLabel = previousStatus.replace(/_/g, " ").toLowerCase();
  return `${volunteerName} moved from ${previousLabel} to ${nextLabel}.`;
}

export async function upsertCrisisResponderStatus(
  crisisEventId: string,
  volunteerId: string,
  status: CrisisResponderStatus
): Promise<CrisisResponderSummary> {
  const [crisis] = await Promise.all([
    assertCrisisExists(crisisEventId),
    assertVolunteer(volunteerId)
  ]);

  // Trust tier check: only Tier 1 (Trainee) or higher can opt into crises.
  // Tier 0 (Reporter) must earn 30 points or get vouched first.
  const tier = await getTrustTier(volunteerId);

  // Check if the volunteer is suspended — suspended volunteers cannot opt in at all
  const profile = await prisma.responderProfile.findUnique({
    where: { userId: volunteerId },
    select: { approvalStatus: true }
  });
  if (profile?.approvalStatus === "SUSPENDED") {
    throw new SafeError(
      "Your responder account is suspended. Contact an administrator."
    );
  }

  if (tier === "REPORTER") {
    throw new SafeError(
      "You need to be a Trainee or higher to opt into crises. Earn 30 points through verified reports and tasks, or get vouched by an approved responder."
    );
  }

  const responder = await prisma.$transaction(async (tx) => {
    const existing = await tx.crisisResponder.findUnique({
      where: {
        crisisEventId_volunteerId: {
          crisisEventId,
          volunteerId
        }
      },
      include: {
        volunteer: {
          select: {
            fullName: true,
            avatarUrl: true,
            skills: true,
            location: true,
            trustTier: true
          }
        }
      }
    });

    const now = new Date();

    if (!existing) {
      const created = await tx.crisisResponder.create({
        data: {
          crisisEventId,
          volunteerId,
          status,
          optedInAt: now,
          lastStatusAt: now
        },
        include: {
          volunteer: {
            select: {
              fullName: true,
              avatarUrl: true,
              skills: true,
              location: true,
              trustTier: true
            }
          }
        }
      });

      await tx.crisisEventUpdate.create({
        data: {
          crisisEventId,
          updaterId: volunteerId,
          previousStatus: crisis.status,
          newStatus: crisis.status,
          updateNote: buildResponderTimelineNote(created.volunteer.fullName, null, status),
          updateType: "RESPONDER_STATUS",
          verificationStatus: "SYSTEM_LOGGED",
          isFlagged: false
        }
      });

      return created;
    }

    assertStatusTransition(existing.status, status);

    if (existing.status === status) {
      return existing;
    }

    const updated = await tx.crisisResponder.update({
      where: { id: existing.id },
      data: {
        status,
        lastStatusAt: now,
        ...(existing.status === "UNAVAILABLE" && status !== "UNAVAILABLE"
          ? { optedInAt: now }
          : {})
      },
      include: {
        volunteer: {
          select: {
            fullName: true,
            avatarUrl: true,
            skills: true,
            location: true,
            trustTier: true
          }
        }
      }
    });

    await tx.crisisEventUpdate.create({
      data: {
        crisisEventId,
        updaterId: volunteerId,
        previousStatus: crisis.status,
        newStatus: crisis.status,
        updateNote: buildResponderTimelineNote(
          updated.volunteer.fullName,
          existing.status,
          status
        ),
        updateType: "RESPONDER_STATUS",
        verificationStatus: "SYSTEM_LOGGED",
        isFlagged: false
      }
    });

    return updated;
  });

  await refreshSituationSummary(crisisEventId);

  // Get contribution counts for this responder
  const [observationCount, resourceNeedCount] = await Promise.all([
    prisma.crisisEventUpdate.count({
      where: { crisisEventId, updaterId: volunteerId, updateType: "FIELD_OBSERVATION" }
    }),
    prisma.crisisEventUpdate.count({
      where: { crisisEventId, updaterId: volunteerId, updateType: "RESOURCE_NEED" }
    }),
  ]);

  return toSummary(responder, { observationCount, resourceNeedCount });
}

export async function listCrisisResponders(
  crisisEventId: string,
  includeUnavailable: boolean
): Promise<CrisisResponderSummary[]> {
  // Only verify the crisis exists — do NOT block listing for RESOLVED/CLOSED crises.
  // The status restriction in assertCrisisExists is for updates only.
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true }
  });
  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  const responders = await prisma.crisisResponder.findMany({
    where: {
      crisisEventId,
      ...(includeUnavailable ? {} : { status: { not: "UNAVAILABLE" } })
    },
    include: {
      volunteer: {
        select: {
          fullName: true,
          avatarUrl: true,
          skills: true,
          location: true,
          trustTier: true
        }
      }
    },
    orderBy: [{ lastStatusAt: "desc" }],
    take: 200
  });

  // Get contribution counts for all responders in this crisis
  const volunteerIds = responders.map((r) => r.volunteerId);
  const [observations, resourceNeeds] = await Promise.all([
    prisma.crisisEventUpdate.groupBy({
      by: ["updaterId"],
      where: { crisisEventId, updaterId: { in: volunteerIds }, updateType: "FIELD_OBSERVATION" },
      _count: { id: true },
    }),
    prisma.crisisEventUpdate.groupBy({
      by: ["updaterId"],
      where: { crisisEventId, updaterId: { in: volunteerIds }, updateType: "RESOURCE_NEED" },
      _count: { id: true },
    }),
  ]);

  const obsMap = new Map(observations.map((o) => [o.updaterId, o._count.id]));
  const needMap = new Map(resourceNeeds.map((r) => [r.updaterId, r._count.id]));

  return responders.map((r) =>
    toSummary(r, {
      observationCount: obsMap.get(r.volunteerId) ?? 0,
      resourceNeedCount: needMap.get(r.volunteerId) ?? 0,
    })
  );
}

export async function getMyResponderStatus(
  crisisEventId: string,
  volunteerId: string
): Promise<CrisisResponderStatus | null> {
  const responder = await prisma.crisisResponder.findUnique({
    where: {
      crisisEventId_volunteerId: {
        crisisEventId,
        volunteerId
      }
    },
    select: { status: true }
  });

  return responder?.status ?? null;
}

export async function isVolunteerResponderForCrisis(
  volunteerId: string,
  crisisEventId: string
): Promise<boolean> {
  const responder = await prisma.crisisResponder.findFirst({
    where: {
      volunteerId,
      crisisEventId,
      status: { in: ACTIVE_RESPONDER_STATUSES }
    },
    select: { id: true }
  });

  return Boolean(responder);
}

/**
 * Check if a volunteer is opted into a crisis as a TRAINEE (Tier 1).
 * Trainees can submit FIELD_OBSERVATION and RESOURCE_NEED updates only.
 */
export async function isTraineeResponder(
  volunteerId: string,
  crisisEventId: string
): Promise<boolean> {
  const [responder, tier] = await Promise.all([
    prisma.crisisResponder.findFirst({
      where: {
        volunteerId,
        crisisEventId,
        status: { in: ACTIVE_RESPONDER_STATUSES }
      },
      select: { id: true }
    }),
    getTrustTier(volunteerId)
  ]);

  return Boolean(responder) && tier === "TRAINEE";
}
