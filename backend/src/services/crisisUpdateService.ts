import type { CrisisEventStatus, IncidentSeverity } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { generateText } from "../services/aiService.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { validateCrisisUpdateInput } from "../utils/validation.js";

const STATUS_ORDER = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED",
  "RESOLVED",
  "CLOSED"
] as const;

const TRUSTED_VOLUNTEER_THRESHOLD = 4.0;

export type CrisisUpdateInput = {
  status: string;
  updateNote: string;
  newSeverity?: IncidentSeverity;
  affectedArea?: string;
  casualtyCount?: number;
  displacedCount?: number;
  damageNotes?: string;
};

export type CrisisUpdateEntry = {
  id: string;
  crisisEventId: string;
  updaterId: string;
  updaterName: string;
  previousStatus: string;
  newStatus: string;
  updateNote: string;
  newSeverity: IncidentSeverity | null;
  affectedArea: string | null;
  casualtyCount: number | null;
  displacedCount: number | null;
  damageNotes: string | null;
  isFlagged: boolean;
  createdAt: string;
};

export async function submitCrisisUpdate(
  crisisEventId: string,
  userId: string,
  userRole: string,
  rawInput: unknown
): Promise<{ entry: CrisisUpdateEntry; isTrusted: boolean }> {
  const validated = validateCrisisUpdateInput(rawInput);

  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId }
  });

  if (!crisisEvent) {
    throw new Error("Crisis event not found");
  }

  const previousStatus = crisisEvent.status;
  const newStatus = validated.status;
  const isConflict = hasSkippedSteps(previousStatus, newStatus);

  const isTrusted = await isTrustedUser(userId, userRole);
  const isFlagged = isConflict && !isTrusted;

  const entry = await prisma.crisisEventUpdate.create({
    data: {
      crisisEventId,
      updaterId: userId,
      previousStatus,
      newStatus,
      updateNote: validated.updateNote,
      newSeverity: validated.newSeverity ?? null,
      affectedArea: validated.affectedArea ?? null,
      casualtyCount: validated.casualtyCount ?? null,
      displacedCount: validated.displacedCount ?? null,
      damageNotes: validated.damageNotes ?? null,
      isFlagged
    },
    include: {
      updater: { select: { fullName: true } }
    }
  });

  if (!isFlagged) {
    await prisma.crisisEvent.update({
      where: { id: crisisEventId },
      data: {
        status: newStatus as typeof previousStatus,
        ...(validated.newSeverity && { severityLevel: validated.newSeverity })
      }
    });

    const updated = await prisma.crisisEvent.findUnique({ where: { id: crisisEventId } });
    if (updated) {
      const sitRepText = await generateSituationSummary(crisisEventId, {
        title: updated.title,
        incidentType: updated.incidentType,
        severityLevel: updated.severityLevel,
        locationText: updated.locationText,
        status: updated.status
      });
      if (sitRepText) {
        await prisma.crisisEvent.update({
          where: { id: crisisEventId },
          data: { sitRepText }
        });
      }
    }
  }

  const mappedEntry = mapUpdateEntry(entry);

  return { entry: mappedEntry, isTrusted };
}

export async function getCrisisUpdates(
  crisisEventId: string
): Promise<CrisisUpdateEntry[]> {
  const updates = await prisma.crisisEventUpdate.findMany({
    where: { crisisEventId },
    orderBy: { createdAt: "asc" },
    include: {
      updater: { select: { fullName: true } }
    }
  });

  return updates.map(mapUpdateEntry);
}

export async function dismissFlaggedUpdate(
  updateId: string,
  adminId: string
): Promise<void> {
  await prisma.crisisEventUpdate.update({
    where: { id: updateId },
    data: { isFlagged: false }
  });
}

export async function revertCrisisStatus(
  crisisEventId: string,
  targetStatus: string,
  adminId: string,
  note: string
): Promise<void> {
  const statusEnum = targetStatus as CrisisEventStatus;

  await prisma.crisisEvent.update({
    where: { id: crisisEventId },
    data: { status: statusEnum }
  });

  await prisma.crisisEventUpdate.create({
    data: {
      crisisEventId,
      updaterId: adminId,
      previousStatus: statusEnum,
      newStatus: statusEnum,
      updateNote: `Admin revert: ${note}`,
      isFlagged: false
    }
  });
}

function hasSkippedSteps(from: string, to: string): boolean {
  const fromIndex = STATUS_ORDER.indexOf(from as typeof STATUS_ORDER[number]);
  const toIndex = STATUS_ORDER.indexOf(to as typeof STATUS_ORDER[number]);

  if (fromIndex === -1 || toIndex === -1) return false;

  if (toIndex <= fromIndex) return false;

  return toIndex - fromIndex > 1;
}

async function isTrustedUser(userId: string, userRole: string): Promise<boolean> {
  if (userRole === "ADMIN") return true;

  const volunteer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isFlagged: true,
      reviewsReceived: {
        select: { rating: true },
        take: 20
      }
    }
  });

  if (!volunteer || volunteer.isFlagged) return false;

  if (volunteer.reviewsReceived.length < 3) return false;

  const avgRating =
    volunteer.reviewsReceived.reduce((sum, r) => sum + r.rating, 0) /
    volunteer.reviewsReceived.length;

  return avgRating >= TRUSTED_VOLUNTEER_THRESHOLD;
}

async function generateSituationSummary(
  crisisEventId: string,
  crisisEvent: {
    title: string;
    incidentType: string;
    severityLevel: string;
    locationText: string;
    status: string;
  }
): Promise<string | null> {
  try {
    const updates = await prisma.crisisEventUpdate.findMany({
      where: { crisisEventId },
      orderBy: { createdAt: "asc" },
      select: {
        updateNote: true,
        previousStatus: true,
        newStatus: true,
        createdAt: true
      }
    });

    const prompt = `Generate a concise situation summary (150-300 words) for a crisis event.

Event: ${crisisEvent.title}
Type: ${crisisEvent.incidentType}
Severity: ${crisisEvent.severityLevel}
Location: ${crisisEvent.locationText}
Current Status: ${crisisEvent.status}

Recent Updates:
${updates
  .map(
    (u) =>
      `[${u.createdAt.toISOString()}] ${u.previousStatus} → ${u.newStatus}: ${u.updateNote}`
  )
  .join("\n")}

Provide only the summary text.`;

    const response = await generateText(prompt);
    return response.trim();
  } catch {
    return null;
  }
}

function mapUpdateEntry(
  entry: {
    updater: { fullName: string };
  } & Record<string, unknown>
): CrisisUpdateEntry {
  return {
    id: entry.id as string,
    crisisEventId: entry.crisisEventId as string,
    updaterId: entry.updaterId as string,
    updaterName: entry.updater.fullName,
    previousStatus: entry.previousStatus as string,
    newStatus: entry.newStatus as string,
    updateNote: entry.updateNote as string,
    newSeverity: entry.newSeverity as IncidentSeverity | null,
    affectedArea: entry.affectedArea as string | null,
    casualtyCount: entry.casualtyCount as number | null,
    displacedCount: entry.displacedCount as number | null,
    damageNotes: entry.damageNotes as string | null,
    isFlagged: entry.isFlagged as boolean,
    createdAt: (entry.createdAt as Date).toISOString()
  };
}
