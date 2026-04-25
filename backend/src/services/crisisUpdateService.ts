import type {
  CrisisAccessStatus,
  CrisisEventStatus,
  CrisisResponderStatus,
  CrisisUpdateType,
  CrisisUpdateVerificationStatus,
  IncidentSeverity,
  Prisma
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { generateText } from "../services/aiService.js";
import {
  dispatchCrisisUpdateNotifications,
  promptAdminsForNgoReport
} from "./notificationService.js";
import { triggerDispatchAlertsForCrisis } from "./dispatchAlertService.js";

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

const ACTIVE_COMMAND_RESPONDER_STATUSES: CrisisResponderStatus[] = [
  "RESPONDING",
  "EN_ROUTE",
  "ON_SITE",
  "COMPLETED"
];

type CrisisStatusLiteral = (typeof STATUS_ORDER)[number];

export type ClosureChecklist = {
  areaSafe: boolean;
  peopleAccounted: boolean;
  urgentNeedsStabilized: boolean;
};

export type ValidatedCrisisUpdateInput = {
  updateType: CrisisUpdateType;
  status: CrisisStatusLiteral;
  updateNote: string;
  newSeverity?: IncidentSeverity;
  affectedArea?: string;
  accessStatus?: CrisisAccessStatus;
  casualtyCount?: number;
  displacedCount?: number;
  damageNotes?: string;
  resourceNeeds?: string[];
  closureChecklist?: ClosureChecklist;
};

export type CrisisUpdateReviewState =
  | "ACTIVE"
  | "PENDING_REVIEW"
  | "DISMISSED";

export type CrisisUpdateEntry = {
  id: string;
  crisisEventId: string;
  updaterId: string;
  updaterName: string;
  previousStatus: string;
  newStatus: string;
  updateType: CrisisUpdateType;
  verificationStatus: CrisisUpdateVerificationStatus;
  updateNote: string;
  newSeverity: IncidentSeverity | null;
  affectedArea: string | null;
  accessStatus: CrisisAccessStatus | null;
  casualtyCount: number | null;
  displacedCount: number | null;
  damageNotes: string | null;
  resourceNeeds: string[];
  closureChecklist: ClosureChecklist | null;
  isFlagged: boolean;
  reviewState: CrisisUpdateReviewState;
  createdAt: string;
};

export type CrisisCommandCenter = {
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  latestNote: string | null;
  latestUpdateType: CrisisUpdateType | null;
  verificationStatus: CrisisUpdateVerificationStatus | null;
  accessStatus: CrisisAccessStatus | null;
  affectedArea: string | null;
  casualtyCount: number | null;
  displacedCount: number | null;
  damageNotes: string | null;
  resourceNeeds: string[];
  closureChecklist: ClosureChecklist | null;
  activeResponderCount: number;
  responderCounts: Record<Exclude<CrisisResponderStatus, "UNAVAILABLE">, number>;
};

type TimelineRecord = Prisma.CrisisEventUpdateGetPayload<{
  include: {
    updater: {
      select: {
        fullName: true;
      };
    };
  };
}>;

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

function humanizeToken(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeUpdateType(
  value: CrisisUpdateType | null | undefined,
  previousStatus: string,
  newStatus: string
): CrisisUpdateType {
  if (value) return value;
  return previousStatus === newStatus ? "FIELD_OBSERVATION" : "STATUS_CHANGE";
}

function normalizeVerificationStatus(
  value: CrisisUpdateVerificationStatus | null | undefined,
  updateType: CrisisUpdateType
): CrisisUpdateVerificationStatus {
  if (value) return value;
  return updateType === "RESPONDER_STATUS"
    ? "SYSTEM_LOGGED"
    : "RESPONDER_CONFIRMED";
}

function parseResourceNeeds(resourceNeedsText: string | null | undefined): string[] {
  if (!resourceNeedsText) return [];

  try {
    const parsed = JSON.parse(resourceNeedsText);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((value) => String(value).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function serializeResourceNeeds(resourceNeeds: string[] | undefined): string | null {
  const normalized = Array.from(
    new Set(
      (resourceNeeds ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function toClosureChecklist(entry: {
  closureAreaSafe: boolean | null;
  closurePeopleAccounted: boolean | null;
  closureNeedsStabilized: boolean | null;
}): ClosureChecklist | null {
  if (
    entry.closureAreaSafe == null &&
    entry.closurePeopleAccounted == null &&
    entry.closureNeedsStabilized == null
  ) {
    return null;
  }

  return {
    areaSafe: entry.closureAreaSafe === true,
    peopleAccounted: entry.closurePeopleAccounted === true,
    urgentNeedsStabilized: entry.closureNeedsStabilized === true
  };
}

function isClosureChecklistComplete(checklist: ClosureChecklist | undefined): boolean {
  return (
    checklist?.areaSafe === true &&
    checklist.peopleAccounted === true &&
    checklist.urgentNeedsStabilized === true
  );
}

function toReviewState(entry: {
  isFlagged: boolean;
  dismissedAt: Date | null;
}): CrisisUpdateReviewState {
  if (entry.dismissedAt) return "DISMISSED";
  if (entry.isFlagged) return "PENDING_REVIEW";
  return "ACTIVE";
}

function mapUpdateEntry(entry: TimelineRecord): CrisisUpdateEntry {
  const updateType = normalizeUpdateType(
    entry.updateType,
    entry.previousStatus,
    entry.newStatus
  );

  return {
    id: entry.id,
    crisisEventId: entry.crisisEventId,
    updaterId: entry.updaterId,
    updaterName: entry.updater.fullName,
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    updateType,
    verificationStatus: normalizeVerificationStatus(
      entry.verificationStatus,
      updateType
    ),
    updateNote: entry.updateNote,
    newSeverity: entry.newSeverity,
    affectedArea: entry.affectedArea,
    accessStatus: entry.accessStatus,
    casualtyCount: entry.casualtyCount,
    displacedCount: entry.displacedCount,
    damageNotes: entry.damageNotes,
    resourceNeeds: parseResourceNeeds(entry.resourceNeedsText),
    closureChecklist: toClosureChecklist(entry),
    isFlagged: entry.isFlagged,
    reviewState: toReviewState(entry),
    createdAt: entry.createdAt.toISOString()
  };
}

async function loadTimelineEntries(
  crisisEventId: string,
  sortOrder: "asc" | "desc" = "asc",
  acceptedOnly = false
): Promise<TimelineRecord[]> {
  return prisma.crisisEventUpdate.findMany({
    where: {
      crisisEventId,
      ...(acceptedOnly ? { isFlagged: false, dismissedAt: null } : {})
    },
    orderBy: { createdAt: sortOrder },
    include: {
      updater: {
        select: {
          fullName: true
        }
      }
    }
  });
}

async function assertCanSubmitCrisisUpdate(
  crisisEventId: string,
  userId: string,
  updateType: CrisisUpdateType,
  targetStatus: CrisisEventStatus
): Promise<"ADMIN" | "VOLUNTEER"> {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isBanned: true }
  });

  if (!actor || actor.isBanned) {
    throw new Error("Account is not allowed to publish field intelligence");
  }

  if (updateType === "RESPONDER_STATUS") {
    throw new Error("Responder timeline entries are generated automatically");
  }

  if (actor.role === "ADMIN") {
    return "ADMIN";
  }

  if (actor.role !== "VOLUNTEER") {
    throw new Error("Only admins or active crisis responders can publish field intelligence");
  }

  if (updateType === "ADMIN_CORRECTION") {
    throw new Error("Only admins can publish correction notes");
  }

  if (targetStatus === "CLOSED") {
    throw new Error("Only admins can close a crisis");
  }

  const responder = await prisma.crisisResponder.findFirst({
    where: {
      crisisEventId,
      volunteerId: userId,
      status: { in: ACTIVE_COMMAND_RESPONDER_STATUSES }
    },
    select: { id: true }
  });

  if (!responder) {
    throw new Error("Opt in to this crisis before publishing field intelligence");
  }

  return "VOLUNTEER";
}

function assertUpdateStructure(
  input: ValidatedCrisisUpdateInput,
  currentStatus: CrisisEventStatus,
  actorRole: "ADMIN" | "VOLUNTEER"
) {
  const statusChanged = input.status !== currentStatus;

  if (input.updateType === "STATUS_CHANGE" && !statusChanged) {
    throw new Error("Choose a new status for a status change");
  }

  if (
    input.updateType !== "STATUS_CHANGE" &&
    input.updateType !== "CLOSURE_NOTE" &&
    statusChanged
  ) {
    throw new Error("Only status changes or closure notes can change the crisis status");
  }

  if (input.updateType === "ADMIN_CORRECTION" && input.status !== currentStatus) {
    throw new Error("Correction notes cannot change the crisis status");
  }

  if (input.updateType === "CLOSURE_NOTE" && !input.closureChecklist) {
    throw new Error("Closure checklist is required for closure notes");
  }

  if (FINAL_STATUSES.includes(input.status) && !isClosureChecklistComplete(input.closureChecklist)) {
    throw new Error("Closure checklist must confirm safety, accountability, and urgent needs");
  }

  if (input.status === "CLOSED" && actorRole !== "ADMIN") {
    throw new Error("Only admins can close a crisis");
  }
}

function buildNotificationLabel(
  updateType: CrisisUpdateType,
  newStatus: CrisisEventStatus,
  statusChanged: boolean
): string {
  if (statusChanged) {
    return humanizeToken(newStatus);
  }

  return humanizeToken(updateType);
}

function buildTimelineContext(entry: CrisisUpdateEntry): string {
  const fragments = [
    `[${entry.createdAt}]`,
    `${humanizeToken(entry.updateType)}`,
    `${humanizeToken(entry.verificationStatus)}`,
    `${entry.updaterName}`,
    `${humanizeToken(entry.previousStatus)} -> ${humanizeToken(entry.newStatus)}`,
    entry.updateNote
  ];

  if (entry.accessStatus) {
    fragments.push(`access ${humanizeToken(entry.accessStatus)}`);
  }

  if (entry.affectedArea) {
    fragments.push(`area ${entry.affectedArea}`);
  }

  if (entry.casualtyCount != null) {
    fragments.push(`casualties ${entry.casualtyCount}`);
  }

  if (entry.displacedCount != null) {
    fragments.push(`displaced ${entry.displacedCount}`);
  }

  if (entry.damageNotes) {
    fragments.push(`damage ${entry.damageNotes}`);
  }

  if (entry.resourceNeeds.length > 0) {
    fragments.push(`needs ${entry.resourceNeeds.join(", ")}`);
  }

  if (entry.closureChecklist) {
    fragments.push(
      `closure area safe ${entry.closureChecklist.areaSafe ? "yes" : "no"}, people accounted ${entry.closureChecklist.peopleAccounted ? "yes" : "no"}, urgent needs stabilised ${entry.closureChecklist.urgentNeedsStabilized ? "yes" : "no"}`
    );
  }

  return fragments.join(" | ");
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
    const updates = (await loadTimelineEntries(crisisEventId, "asc", true)).map(mapUpdateEntry);

    const prompt = `You are an emergency response analyst writing a situation update for a crisis event.

Event: ${crisisEvent.title}
Type: ${crisisEvent.incidentType}
Severity: ${crisisEvent.severityLevel}
Location: ${crisisEvent.locationText}
Current Status: ${crisisEvent.status}

Verified Command Timeline:
${updates.map((entry) => buildTimelineContext(entry)).join("\n")}

Output format (strict Markdown):
- Line 1: a single **bold** one-sentence headline describing the current state (under 25 words).
- Blank line.
- A short paragraph (2 to 3 sentences) summarising the latest verified situation.
- Blank line.
- 3 to 5 bullet points starting with "- " describing current field intelligence, responder posture, access constraints, or outstanding needs.
- Do not use headings, numbered lists, code fences, links, or any preamble.
- Total length between 120 and 220 words.

Return only the Markdown content.`;

    const response = await generateText(prompt);
    return response.trim();
  } catch {
    return null;
  }
}

export async function refreshSituationSummary(crisisEventId: string): Promise<void> {
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
  updateLabel: string,
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
    updateLabel,
    event.latitude,
    event.longitude
  );

  if (FINAL_STATUSES.includes(event.status)) {
    await promptAdminsForNgoReport(crisisEventId, event.title, event.status);
  }
}

export async function submitCrisisUpdate(
  crisisEventId: string,
  userId: string,
  _userRole: string,
  input: ValidatedCrisisUpdateInput
): Promise<{ entry: CrisisUpdateEntry; applied: boolean }> {
  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId }
  });

  if (!crisisEvent) {
    throw new Error("Crisis event not found");
  }

  const actorRole = await assertCanSubmitCrisisUpdate(
    crisisEventId,
    userId,
    input.updateType,
    input.status
  );

  assertUpdateStructure(input, crisisEvent.status, actorRole);

  const previousStatus = crisisEvent.status;
  const statusChanged = input.status !== previousStatus;
  const isFlagged = actorRole !== "ADMIN" && statusChanged && isConflictingTransition(previousStatus, input.status);
  const verificationStatus =
    actorRole === "ADMIN" ? "ADMIN_CONFIRMED" : "RESPONDER_CONFIRMED";
  const reviewState: CrisisUpdateReviewState = isFlagged ? "PENDING_REVIEW" : "ACTIVE";

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.crisisEventUpdate.create({
      data: {
        crisisEventId,
        updaterId: userId,
        previousStatus,
        newStatus: input.status,
        updateNote: input.updateNote,
        updateType: input.updateType,
        verificationStatus,
        newSeverity: input.newSeverity ?? null,
        affectedArea: input.affectedArea ?? null,
        accessStatus: input.accessStatus ?? null,
        casualtyCount: input.casualtyCount ?? null,
        displacedCount: input.displacedCount ?? null,
        damageNotes: input.damageNotes ?? null,
        resourceNeedsText: serializeResourceNeeds(input.resourceNeeds),
        closureAreaSafe: input.closureChecklist?.areaSafe ?? null,
        closurePeopleAccounted: input.closureChecklist?.peopleAccounted ?? null,
        closureNeedsStabilized: input.closureChecklist?.urgentNeedsStabilized ?? null,
        isFlagged
      },
      include: {
        updater: {
          select: {
            fullName: true
          }
        }
      }
    });

    if (!isFlagged && (statusChanged || input.newSeverity)) {
      await tx.crisisEvent.update({
        where: { id: crisisEventId },
        data: {
          ...(statusChanged ? { status: input.status } : {}),
          ...(input.newSeverity ? { severityLevel: input.newSeverity } : {})
        }
      });
    }

    return created;
  });

  const mappedEntry = mapUpdateEntry(entry);

  if (reviewState === "ACTIVE") {
    await refreshSituationSummary(crisisEventId);
    await publishUpdateSideEffects(
      crisisEventId,
      buildNotificationLabel(input.updateType, input.status, statusChanged),
      input.updateNote
    );

    const currentSeverity = input.newSeverity ?? crisisEvent.severityLevel;
    if (
      statusChanged &&
      input.status === "VERIFIED" &&
      (currentSeverity === "CRITICAL" || currentSeverity === "HIGH")
    ) {
      triggerDispatchAlertsForCrisis(crisisEventId).catch(console.error);
    }
  }

  return {
    entry: {
      ...mappedEntry,
      reviewState
    },
    applied: reviewState === "ACTIVE"
  };
}

export async function getCrisisUpdates(
  crisisEventId: string
): Promise<CrisisUpdateEntry[]> {
  const updates = await loadTimelineEntries(crisisEventId, "asc");
  return updates.map(mapUpdateEntry);
}

export async function getCrisisCommandCenter(
  crisisEventId: string
): Promise<CrisisCommandCenter> {
  const [updates, responders] = await Promise.all([
    loadTimelineEntries(crisisEventId, "desc", true),
    prisma.crisisResponder.findMany({
      where: { crisisEventId },
      select: { status: true }
    })
  ]);

  const mappedUpdates = updates.map(mapUpdateEntry);
  const commandUpdates = mappedUpdates.filter(
    (entry) => entry.updateType !== "RESPONDER_STATUS"
  );

  const latestCommandEntry = commandUpdates[0] ?? null;
  const latestAccessStatus =
    commandUpdates.find((entry) => entry.accessStatus != null)?.accessStatus ?? null;
  const latestAffectedArea =
    commandUpdates.find((entry) => entry.affectedArea)?.affectedArea ?? null;
  const latestCasualtyCount =
    commandUpdates.find((entry) => entry.casualtyCount != null)?.casualtyCount ?? null;
  const latestDisplacedCount =
    commandUpdates.find((entry) => entry.displacedCount != null)?.displacedCount ?? null;
  const latestDamageNotes =
    commandUpdates.find((entry) => entry.damageNotes)?.damageNotes ?? null;
  const latestResourceNeeds =
    commandUpdates.find((entry) => entry.resourceNeeds.length > 0)?.resourceNeeds ?? [];
  const latestClosureChecklist =
    commandUpdates.find((entry) => entry.closureChecklist != null)?.closureChecklist ?? null;

  const responderCounts: CrisisCommandCenter["responderCounts"] = {
    RESPONDING: 0,
    EN_ROUTE: 0,
    ON_SITE: 0,
    COMPLETED: 0
  };

  for (const responder of responders) {
    if (responder.status in responderCounts) {
      responderCounts[responder.status as keyof typeof responderCounts] += 1;
    }
  }

  return {
    lastVerifiedAt: latestCommandEntry?.createdAt ?? null,
    lastVerifiedBy: latestCommandEntry?.updaterName ?? null,
    latestNote: latestCommandEntry?.updateNote ?? null,
    latestUpdateType: latestCommandEntry?.updateType ?? null,
    verificationStatus: latestCommandEntry?.verificationStatus ?? null,
    accessStatus: latestAccessStatus,
    affectedArea: latestAffectedArea,
    casualtyCount: latestCasualtyCount,
    displacedCount: latestDisplacedCount,
    damageNotes: latestDamageNotes,
    resourceNeeds: latestResourceNeeds,
    closureChecklist: latestClosureChecklist,
    activeResponderCount:
      responderCounts.RESPONDING +
      responderCounts.EN_ROUTE +
      responderCounts.ON_SITE +
      responderCounts.COMPLETED,
    responderCounts
  };
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
        updateNote: note.trim(),
        updateType: "ADMIN_CORRECTION",
        verificationStatus: "ADMIN_CONFIRMED",
        isFlagged: false
      }
    })
  ]);

  await refreshSituationSummary(crisisEventId);
  await publishUpdateSideEffects(
    crisisEventId,
    humanizeToken(targetStatus),
    note.trim()
  );
}
