import type { CrisisResponderStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

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
    };
  }
): CrisisResponderSummary {
  return {
    id: record.id,
    volunteerId: record.volunteerId,
    volunteerName: record.volunteer.fullName,
    avatarUrl: record.volunteer.avatarUrl,
    skills: record.volunteer.skills,
    location: record.volunteer.location,
    status: record.status,
    optedInAt: record.optedInAt.toISOString(),
    lastStatusAt: record.lastStatusAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

async function assertCrisisExists(crisisEventId: string): Promise<void> {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true }
  });

  if (!crisis) {
    throw new Error("Crisis event not found");
  }
}

async function assertVolunteer(volunteerId: string): Promise<void> {
  const volunteer = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: { role: true, isBanned: true }
  });

  if (!volunteer || volunteer.role !== "VOLUNTEER") {
    throw new Error("Volunteer account required");
  }

  if (volunteer.isBanned) {
    throw new Error("Volunteer account is banned");
  }
}

function assertStatusTransition(
  previousStatus: CrisisResponderStatus,
  nextStatus: CrisisResponderStatus
) {
  if (previousStatus === nextStatus) return;
  if (!STATUS_FLOW[previousStatus].includes(nextStatus)) {
    throw new Error(
      `Invalid responder status transition: ${previousStatus} -> ${nextStatus}`
    );
  }
}

export async function upsertCrisisResponderStatus(
  crisisEventId: string,
  volunteerId: string,
  status: CrisisResponderStatus
): Promise<CrisisResponderSummary> {
  await Promise.all([
    assertCrisisExists(crisisEventId),
    assertVolunteer(volunteerId)
  ]);

  const existing = await prisma.crisisResponder.findUnique({
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
          location: true
        }
      }
    }
  });

  const now = new Date();

  if (!existing) {
    const created = await prisma.crisisResponder.create({
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
            location: true
          }
        }
      }
    });

    return toSummary(created);
  }

  assertStatusTransition(existing.status, status);

  const updated = await prisma.crisisResponder.update({
    where: { id: existing.id },
    data: {
      status,
      lastStatusAt: now,
      // Re-capture opt-in time when coming back from unavailable.
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
          location: true
        }
      }
    }
  });

  return toSummary(updated);
}

export async function listCrisisResponders(
  crisisEventId: string,
  includeUnavailable: boolean
): Promise<CrisisResponderSummary[]> {
  await assertCrisisExists(crisisEventId);

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
          location: true
        }
      }
    },
    orderBy: [{ lastStatusAt: "desc" }]
  });

  return responders.map(toSummary);
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
