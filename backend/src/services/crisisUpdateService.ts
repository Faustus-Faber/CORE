import type { CrisisEventStatus, IncidentSeverity } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { generateText } from "../services/aiService.js";
import {
  dispatchCrisisUpdateNotifications,
  promptAdminsForNgoReport
} from "./notificationService.js";
import { triggerAlertsForCrisis } from "./twilioService.js";

const STATUS_ORDER = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED",
  "RESOLVED",
  "CLOSED"
] as const;

const FINAL_STATUSES: CrisisEventStatus[] = ["RESOLVED", "CLOSED"];

const TRUSTED_VOLUNTEER_THRESHOLD = 4.0;
const MIN_REVIEWS_FOR_TRUST = 3;

type CrisisStatusLiteral = (typeof STATUS_ORDER)[number];

export type ValidatedCrisisUpdateInput = {
  status: CrisisStatusLiteral;
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

function isValidCrisisStatus(value: string): value is CrisisStatusLiteral {
  return STATUS_ORDER.includes(value as CrisisStatusLiteral);
}

function isConflictingTransition(from: string, to: string): boolean {
  const fromIndex = STATUS_ORDER.indexOf(from as CrisisStatusLiteral);
  const toIndex = STATUS_ORDER.indexOf(to as CrisisStatusLiteral);

  if (fromIndex === -1 || toIndex === -1) return false;
  if (toIndex === fromIndex) return false;

  return toIndex < fromIndex || toIndex - fromIndex > 1;
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
  if (volunteer.reviewsReceived.length < MIN_REVIEWS_FOR_TRUST) return false;

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

    const prompt = `You are an emergency response analyst writing a situation update for a crisis event.

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

Output format (strict Markdown):
- Line 1: a single **bold** one-sentence headline describing the current state (under 25 words).
- Blank line.
- A short paragraph (2 to 3 sentences) summarising what has happened so far.
- Blank line.
- 3 to 5 bullet points starting with "- " describing the latest operational developments, response actions, or outstanding risks.
- Do not use headings, numbered lists, code fences, links, or any preamble.
- Total length between 120 and 220 words.

Return only the Markdown content.`;

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

export async function submitCrisisUpdate(
  crisisEventId: string,
  userId: string,
  userRole: string,
  input: ValidatedCrisisUpdateInput
): Promise<{ entry: CrisisUpdateEntry; isTrusted: boolean }> {
  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId }
  });

  if (!crisisEvent) {
    throw new Error("Crisis event not found");
  }

  const previousStatus = crisisEvent.status;
  const newStatus = input.status;
  const isConflict = isConflictingTransition(previousStatus, newStatus);
  const isTrusted = await isTrustedUser(userId, userRole);
  const isFlagged = isConflict && !isTrusted;

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.crisisEventUpdate.create({
      data: {
        crisisEventId,
        updaterId: userId,
        previousStatus,
        newStatus,
        updateNote: input.updateNote,
        newSeverity: input.newSeverity ?? null,
        affectedArea: input.affectedArea ?? null,
        casualtyCount: input.casualtyCount ?? null,
        displacedCount: input.displacedCount ?? null,
        damageNotes: input.damageNotes ?? null,
        isFlagged
      },
      include: {
        updater: { select: { fullName: true } }
      }
    });

    if (!isFlagged) {
      await tx.crisisEvent.update({
        where: { id: crisisEventId },
        data: {
          status: newStatus,
          ...(input.newSeverity && { severityLevel: input.newSeverity })
        }
      });
    }

    return created;
  });

  if (!isFlagged) {
    await refreshSituationSummary(crisisEventId);
    if (previousStatus !== newStatus) {
      await publishUpdateSideEffects(crisisEventId, newStatus, input.updateNote);
    }
    
    const currentSeverity = input.newSeverity ?? crisisEvent.severityLevel;
    if (newStatus === "VERIFIED" && (currentSeverity === "CRITICAL" || currentSeverity === "HIGH")) {
      // Fire and forget
      triggerAlertsForCrisis(crisisEventId).catch(console.error);
    }
  }

  return { entry: mapUpdateEntry(entry), isTrusted };
}

async function refreshSituationSummary(crisisEventId: string): Promise<void> {
  const updated = await prisma.crisisEvent.findUnique({ where: { id: crisisEventId } });
  if (!updated) return;

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

async function publishUpdateSideEffects(
  crisisEventId: string,
  newStatus: CrisisStatusLiteral,
  updateNote: string
): Promise<void> {
  const event = await prisma.crisisEvent.findUnique({ where: { id: crisisEventId } });
  if (!event) return;

  await dispatchCrisisUpdateNotifications(
    crisisEventId,
    event.incidentType,
    event.severityLevel,
    event.title,
    updateNote,
    newStatus,
    event.latitude,
    event.longitude
  );

  if (FINAL_STATUSES.includes(newStatus)) {
    await promptAdminsForNgoReport(crisisEventId, event.title, newStatus);
  }
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
    data: {
      isFlagged: false,
      dismissedById: adminId,
      dismissedAt: new Date()
    }
  });
}

export async function revertCrisisStatus(
  crisisEventId: string,
  targetStatus: string,
  adminId: string,
  note: string
): Promise<void> {
  if (!isValidCrisisStatus(targetStatus)) {
    throw new Error("Invalid target status");
  }

  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { status: true }
  });

  if (!crisisEvent) {
    throw new Error("Crisis event not found");
  }

  const previousStatus = crisisEvent.status;

  await prisma.$transaction([
    prisma.crisisEvent.update({
      where: { id: crisisEventId },
      data: { status: targetStatus }
    }),
    prisma.crisisEventUpdate.create({
      data: {
        crisisEventId,
        updaterId: adminId,
        previousStatus,
        newStatus: targetStatus,
        updateNote: `Admin revert: ${note}`,
        isFlagged: false
      }
    })
  ]);

  await refreshSituationSummary(crisisEventId);
}
