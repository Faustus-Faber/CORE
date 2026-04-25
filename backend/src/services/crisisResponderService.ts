import type { CrisisEventStatus, CrisisResponderStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { refreshSituationSummary } from "./crisisUpdateService.js";

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

async function assertCrisisExists(
  crisisEventId: string
): Promise<{ id: string; status: CrisisEventStatus }> {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true, status: true }
  });

  if (!crisis) {
    throw new Error("Crisis event not found");
  }

  return crisis;
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
            location: true
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
              location: true
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
            location: true
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

  return toSummary(responder);
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
