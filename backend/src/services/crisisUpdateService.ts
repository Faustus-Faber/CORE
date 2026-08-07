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
import { SafeError } from "../utils/SafeError.js";
import {
  dispatchCrisisUpdateNotifications,
  promptAdminsForNgoReport
} from "./notificationService.js";
import { triggerDispatchAlertsForCrisis } from "./dispatchAlertService.js";
import { isTraineeResponder } from "./crisisResponderService.js";
import {
  assertCanSubmitUpdateType,
  shouldFlagUpdate,
  checkAndPromoteTrustTier,
} from "./trustTierService.js";
import type { TrustTier } from "@prisma/client";

// P1-10: In-memory cache for situation reports keyed by crisisEventId:version.
// Avoids redundant LLM calls when the crisis version hasn't changed.
const sitRepCache = new Map<string, string>();

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
  updaterTrustTier: string | null;
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
        trustTier: true;
        role: true;
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
    updaterTrustTier: entry.updater.role === "ADMIN" ? "ADMIN" : entry.updater.trustTier,
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
  // Fetch all entries for the crisis without filtering on isFlagged/dismissedAt
  // at the MongoDB level. Seeded records may not have these fields explicitly
  // stored (MongoDB omits unset fields), so a query like { isFlagged: false }
  // would incorrectly exclude them. Filter in memory instead.
  const entries = await prisma.crisisEventUpdate.findMany({
    where: { crisisEventId },
    orderBy: { createdAt: sortOrder },
    take: 200,
    include: {
      updater: {
        select: {
          fullName: true,
          trustTier: true,
          role: true
        }
      }
    }
  });

  if (!acceptedOnly) return entries;

  return entries.filter(
    (entry) => !entry.isFlagged && entry.dismissedAt === null
  );
}

async function assertCanSubmitCrisisUpdate(
  crisisEventId: string,
  userId: string,
  updateType: CrisisUpdateType,
  targetStatus: CrisisEventStatus
): Promise<{ actorRole: "ADMIN" | "VOLUNTEER"; tier: TrustTier }> {
  // Trust tier check (replaces old responder approval logic)
  const { actorRole, tier } = await assertCanSubmitUpdateType(userId, updateType, targetStatus);

  if (actorRole === "ADMIN") {
    return { actorRole: "ADMIN", tier };
  }

  // P1-6: Prevent volunteers from updating resolved or closed crises
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { status: true }
  });
  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }
  if (FINAL_STATUSES.includes(crisis.status)) {
    throw new SafeError("Cannot submit updates on a resolved or closed crisis");
  }

  // Volunteers must be opted into the crisis as an active responder
  const responder = await prisma.crisisResponder.findFirst({
    where: {
      crisisEventId,
      volunteerId: userId,
      status: { in: ACTIVE_COMMAND_RESPONDER_STATUSES }
    },
    select: { id: true }
  });

  if (!responder) {
    throw new SafeError("Opt in to this crisis before publishing field intelligence");
  }

  return { actorRole: "VOLUNTEER", tier };
}

function assertUpdateStructure(
  input: ValidatedCrisisUpdateInput,
  currentStatus: CrisisEventStatus,
  actorRole: "ADMIN" | "VOLUNTEER"
) {
  const statusChanged = input.status !== currentStatus;

  if (input.updateType === "STATUS_CHANGE" && !statusChanged) {
    throw new SafeError("Choose a new status for a status change");
  }

  if (
    input.updateType !== "STATUS_CHANGE" &&
    input.updateType !== "CLOSURE_NOTE" &&
    statusChanged
  ) {
    throw new SafeError("Only status changes or closure notes can change the crisis status");
  }

  if (input.updateType === "ADMIN_CORRECTION" && input.status !== currentStatus) {
    throw new SafeError("Correction notes cannot change the crisis status");
  }

  if (input.updateType === "CLOSURE_NOTE" && !input.closureChecklist) {
    throw new SafeError("Closure checklist is required for closure notes");
  }

  if (FINAL_STATUSES.includes(input.status) && !isClosureChecklistComplete(input.closureChecklist)) {
    throw new SafeError("Closure checklist must confirm safety, accountability, and urgent needs");
  }

  if (input.status === "CLOSED" && actorRole !== "ADMIN") {
    throw new SafeError("Only admins can close a crisis");
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

Verified Command Timeline (each entry includes its source):
${updates.map((entry) => buildTimelineContext(entry)).join("\n")}

Output format (strict Markdown):
- Line 1: a single **bold** one-sentence headline describing the current state (under 25 words).
- Blank line.
- A short paragraph (2 to 3 sentences) summarising the latest verified situation. Cite sources inline using [Source: <role/entry-type> <time>] notation.
- Blank line.
- 3 to 5 bullet points starting with "- " describing current field intelligence, responder posture, access constraints, or outstanding needs. Each bullet must end with a source attribution in [Source: ...] format.
- Do not use headings, numbered lists, code fences, links, or any preamble.
- Total length between 120 and 250 words.

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

  // P1-10: Skip regeneration if we already have a cached sitRep for this version
  const cacheKey = `${crisisEventId}:${updated.version}`;
  const cached = sitRepCache.get(cacheKey);
  if (cached) {
    await prisma.crisisEvent.update({
      where: { id: crisisEventId },
      data: { sitRepText: cached }
    });
    return;
  }

  const sitRepText = await generateSituationSummary(crisisEventId, {
    title: updated.title,
    incidentType: updated.incidentType,
    severityLevel: updated.severityLevel,
    locationText: updated.locationText,
    status: updated.status
  });

  if (sitRepText) {
    sitRepCache.set(cacheKey, sitRepText);
    // Clean up old cache entries for this crisis (keep only the latest version)
    for (const key of sitRepCache.keys()) {
      if (key.startsWith(`${crisisEventId}:`) && key !== cacheKey) {
        sitRepCache.delete(key);
      }
    }
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

// ── Conflict detection: simultaneous conflicting status changes ─────────────
const CONFLICT_WINDOW_MINUTES = 5;

/**
 * Check if another volunteer submitted a STATUS_CHANGE with a different target
 * status within the last CONFLICT_WINDOW_MINUTES minutes. If found, flag those
 * existing updates as PENDING_REVIEW so the admin can resolve the conflict.
 *
 * Returns true if a conflict was found (the new update should also be flagged).
 */
async function checkSimultaneousConflict(
  crisisEventId: string,
  currentVolunteerId: string,
  newTargetStatus: CrisisEventStatus
): Promise<boolean> {
  const cutoff = new Date(Date.now() - CONFLICT_WINDOW_MINUTES * 60 * 1000);

  const recentConflicting = await prisma.crisisEventUpdate.findMany({
    where: {
      crisisEventId,
      updaterId: { not: currentVolunteerId },
      updateType: "STATUS_CHANGE",
      newStatus: { not: newTargetStatus },
      createdAt: { gte: cutoff },
      isFlagged: false,
      dismissedAt: null
    },
    select: { id: true }
  });

  if (recentConflicting.length === 0) return false;

  // Flag the existing conflicting updates for admin review
  await prisma.crisisEventUpdate.updateMany({
    where: { id: { in: recentConflicting.map((u) => u.id) } },
    data: { isFlagged: true }
  });

  return true;
}

export async function submitCrisisUpdate(
  crisisEventId: string,
  userId: string,
  _userRole: string,
  input: ValidatedCrisisUpdateInput,
  expectedVersion?: number
): Promise<{ entry: CrisisUpdateEntry; applied: boolean }> {
  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId }
  });

  if (!crisisEvent) {
    throw new SafeError("Crisis event not found");
  }

  // FR-07: Optimistic concurrency — reject if the client's expected version
  // doesn't match the current version (another update was applied in the meantime)
  if (expectedVersion != null && crisisEvent.version !== expectedVersion) {
    throw new SafeError(
      `Conflict: crisis event version mismatch (expected ${expectedVersion}, current ${crisisEvent.version}). Please refresh and retry.`
    );
  }

  const { actorRole, tier } = await assertCanSubmitCrisisUpdate(
    crisisEventId,
    userId,
    input.updateType,
    input.status
  );

  assertUpdateStructure(input, crisisEvent.status, actorRole);

  const previousStatus = crisisEvent.status;
  const statusChanged = input.status !== previousStatus;
  const isConflictingStatus = actorRole !== "ADMIN" && statusChanged && isConflictingTransition(previousStatus, input.status);

  // ── Conflict detection: check for simultaneous conflicting status changes ──
  // If another volunteer submitted a STATUS_CHANGE with a different target
  // status within the last 5 minutes, flag BOTH updates for admin review.
  let hasSimultaneousConflict = false;
  if (actorRole === "VOLUNTEER" && statusChanged) {
    hasSimultaneousConflict = await checkSimultaneousConflict(crisisEventId, userId, input.status);
  }

  // Trust tier-based flagging: trainees' first N observations are flagged,
  // then auto-approved (trust earned through track record).
  // Responders/Veterans are not flagged (unless conflict detection triggers).
  const shouldFlagTrainee = await shouldFlagUpdate(userId, input.updateType, tier);

  const isFlagged = isConflictingStatus || hasSimultaneousConflict || shouldFlagTrainee;
  const verificationStatus =
    actorRole === "ADMIN"
      ? "ADMIN_CONFIRMED"
      : shouldFlagTrainee
        ? "SELF_REPORTED"
        : "RESPONDER_CONFIRMED";
  const reviewState: CrisisUpdateReviewState = isFlagged ? "PENDING_REVIEW" : "ACTIVE";

  // Validate update note length to prevent abuse and storage bloat
  if (input.updateNote && input.updateNote.length > 5000) {
    throw new SafeError("Update note must be 5000 characters or less");
  }

  const entry = await prisma.$transaction(async (tx) => {
    // FR-07: Re-check version inside the transaction to prevent race conditions
    const current = await tx.crisisEvent.findUnique({
      where: { id: crisisEventId },
      select: { version: true }
    });
    if (current && expectedVersion != null && current.version !== expectedVersion) {
      throw new SafeError(
        `Conflict: crisis event version mismatch (expected ${expectedVersion}, current ${current.version}). Please refresh and retry.`
      );
    }

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
            fullName: true,
            trustTier: true,
            role: true
          }
        }
      }
    });

    if (!isFlagged && (statusChanged || input.newSeverity)) {
      await tx.crisisEvent.update({
        where: { id: crisisEventId },
        data: {
          ...(statusChanged ? { status: input.status } : {}),
          ...(input.newSeverity ? { severityLevel: input.newSeverity } : {}),
          // FR-07: Increment version on each applied update
          version: { increment: 1 }
        }
      });
    }

    // If this is a RESOURCE_NEED update, create Need records
    // from the resource needs tags so they appear in the workspace and can be assigned.
    // This runs for both active and flagged (trainee) updates — resource needs are
    // always actionable even if the update itself is pending review.
    if (input.updateType === "RESOURCE_NEED") {
      // Use structured resourceNeeds if provided, otherwise fall back to parsing the update note
      const needTags = (input.resourceNeeds && input.resourceNeeds.length > 0)
        ? input.resourceNeeds
        : (input.updateNote?.trim() ? [input.updateNote.trim()] : []);

      for (const needTag of needTags) {
        await tx.need.create({
          data: {
            crisisEventId,
            needType: needTag,
            description: input.updateNote?.trim() || `Resource need reported by ${created.updater.fullName}`,
            quantity: 1,
            unit: "units",
            urgency: "HIGH",
            isMet: false
          }
        });
      }
    }

    return created;
  });

  const mappedEntry = mapUpdateEntry(entry);

  // P0-11: Side effects are fire-and-forget — the primary transaction has already committed.
  // Failures in notifications, AI summaries, or dispatch alerts do NOT cause the client
  // to receive an error (which would lead to retries and duplicate timeline entries).
  if (reviewState === "ACTIVE") {
    // Run side effects asynchronously without blocking the response
    Promise.resolve().then(async () => {
      try {
        await refreshSituationSummary(crisisEventId);
      } catch (err) {
        console.error("[side-effect] Failed to refresh situation summary:", err);
      }

      try {
        await publishUpdateSideEffects(
          crisisEventId,
          buildNotificationLabel(input.updateType, input.status, statusChanged),
          input.updateNote
        );
      } catch (err) {
        console.error("[side-effect] Failed to publish update side effects:", err);
      }

      const currentSeverity = input.newSeverity ?? crisisEvent.severityLevel;
      if (
        statusChanged &&
        input.status === "VERIFIED" &&
        (currentSeverity === "CRITICAL" || currentSeverity === "HIGH")
      ) {
        try {
          await triggerDispatchAlertsForCrisis(crisisEventId);
        } catch (err) {
          console.error("[side-effect] Failed to trigger dispatch alerts:", err);
        }
      }
    }).catch(() => {});
  }

  // If this update was flagged due to a simultaneous conflict, run AI analysis
  // to compare the conflicting updates against the timeline and recommend
  // which one is more likely correct. The recommendation is stored for admin review.
  if (hasSimultaneousConflict) {
    Promise.resolve().then(async () => {
      try {
        await generateConflictResolution(crisisEventId, entry.id, userId);
      } catch (err) {
        console.error("[side-effect] Failed to generate AI conflict resolution:", err);
      }
    }).catch(() => {});
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
  crisisEventId: string,
  viewerRole?: string
): Promise<CrisisUpdateEntry[]> {
  // P1-7: Exclude pending/dismissed field updates from public timelines
  // Admins see everything; other roles only see ACTIVE (non-flagged, non-dismissed) entries
  const acceptedOnly = viewerRole !== "ADMIN";
  const updates = await loadTimelineEntries(crisisEventId, "asc", acceptedOnly);
  return updates.map(mapUpdateEntry);
}

export async function getCrisisCommandCenter(
  crisisEventId: string
): Promise<CrisisCommandCenter> {
  const [updates, responders] = await Promise.all([
    loadTimelineEntries(crisisEventId, "desc", true),
    prisma.crisisResponder.findMany({
      where: { crisisEventId },
      select: { status: true },
      take: 500
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

/**
 * Admin approves a flagged update (typically from a trainee).
 * Unflags the update and awards points to the volunteer who submitted it.
 * Points: FIELD_OBSERVATION = +10, RESOURCE_NEED = +5, other = +5
 */
export async function approveFlaggedUpdate(
  updateId: string,
  adminId: string
): Promise<{ pointsAwarded: number }> {
  const update = await prisma.crisisEventUpdate.findUnique({
    where: { id: updateId },
    select: { id: true, updaterId: true, updateType: true, isFlagged: true }
  });

  if (!update) throw new SafeError("Update not found");
  if (!update.isFlagged) throw new SafeError("Update is not flagged");

  // Award points based on update type
  const POINTS_MAP: Record<string, number> = {
    FIELD_OBSERVATION: 10,
    RESOURCE_NEED: 5,
    STATUS_CHANGE: 15,
    ACCESS_UPDATE: 5,
    IMPACT_UPDATE: 10,
    CLOSURE_NOTE: 20,
    ADMIN_CORRECTION: 0
  };
  const pointsAwarded = (update.updateType && POINTS_MAP[update.updateType]) ?? 5;

  await prisma.$transaction(async (tx) => {
    // Unflag the update
    await tx.crisisEventUpdate.update({
      where: { id: updateId },
      data: {
        isFlagged: false,
        dismissedById: adminId,
        dismissedAt: new Date(),
        verificationStatus: "ADMIN_CONFIRMED"
      }
    });

    // Award points to the volunteer
    await tx.user.update({
      where: { id: update.updaterId },
      data: { totalPoints: { increment: pointsAwarded } }
    });
  });

  // Check for trust tier promotion and badges (non-critical, fire-and-forget)
  try {
    const { checkAndAwardBadges } = await import("./timesheetService.js");
    const { checkAndPromoteTrustTier } = await import("./trustTierService.js");
    await checkAndAwardBadges(update.updaterId);
    await checkAndPromoteTrustTier(update.updaterId);
  } catch (err) {
    console.error("[approve-flagged] Trust tier promotion/badge check failed:", err);
  }

  return { pointsAwarded };
}

export async function revertCrisisStatus(
  crisisEventId: string,
  targetStatus: string,
  adminId: string,
  note: string
): Promise<void> {
  if (!isValidCrisisStatus(targetStatus)) {
    throw new SafeError("Invalid target status");
  }

  // Read the current status inside the transaction to ensure the
  // previousStatus recorded in the audit trail is accurate.
  await prisma.$transaction(async (tx) => {
    const crisisEvent = await tx.crisisEvent.findUnique({
      where: { id: crisisEventId },
      select: { status: true }
    });

    if (!crisisEvent) {
      throw new SafeError("Crisis event not found");
    }

    const previousStatus = crisisEvent.status;

    await tx.crisisEvent.update({
      where: { id: crisisEventId },
      data: { status: targetStatus }
    });

    await tx.crisisEventUpdate.create({
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
    });
  });

  await refreshSituationSummary(crisisEventId);
  await publishUpdateSideEffects(
    crisisEventId,
    humanizeToken(targetStatus),
    note.trim()
  );
}

// ── AI-assisted conflict resolution ─────────────────────────────────────────

/**
 * When two volunteers submit conflicting status changes within 5 minutes,
 * AI analyzes both updates against the existing timeline and volunteer
 * reputation to recommend which is more likely correct.
 *
 * The recommendation is stored in a ConflictResolution record for the admin
 * to review when making their final decision.
 */
async function generateConflictResolution(
  crisisEventId: string,
  newUpdateId: string,
  newUpdateAuthorId: string
): Promise<void> {
  const cutoff = new Date(Date.now() - CONFLICT_WINDOW_MINUTES * 60 * 1000);

  // Fetch all flagged updates in the conflict window (including the new one)
  const conflictingUpdates = await prisma.crisisEventUpdate.findMany({
    where: {
      crisisEventId,
      isFlagged: true,
      dismissedAt: null,
      createdAt: { gte: cutoff }
    },
    include: {
      updater: {
        select: {
          id: true,
          fullName: true,
          trustTier: true,
          role: true,
          totalPoints: true,
          totalVerifiedHours: true,
          badges: { select: { badgeType: true } }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  if (conflictingUpdates.length < 2) return;

  // Fetch recent timeline context (last 10 non-flagged updates before the conflict)
  const contextUpdates = await prisma.crisisEventUpdate.findMany({
    where: {
      crisisEventId,
      isFlagged: false,
      dismissedAt: null,
      createdAt: { lt: cutoff }
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      updateNote: true,
      newStatus: true,
      updateType: true,
      createdAt: true,
      updater: { select: { fullName: true, trustTier: true, role: true } }
    }
  });

  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { title: true, status: true, incidentType: true, locationText: true }
  });

  if (!crisis) return;

  // Build the prompt for AI analysis
  const timelineContext = contextUpdates
    .map((u) => `[${u.createdAt.toISOString()}] ${u.updater.fullName}: "${u.updateNote}" (status: ${u.newStatus})`)
    .join("\n");

  const conflictDescriptions = conflictingUpdates
    .map((u, i) => {
      const badges = u.updater.badges.map((b) => b.badgeType).join(", ") || "none";
      return `Update ${i + 1}:
  - Author: ${u.updater.fullName}
  - Reputation: ${u.updater.totalPoints} points, ${u.updater.totalVerifiedHours} verified hours, badges: ${badges}
  - Proposed status: ${u.newStatus}
  - Note: "${u.updateNote}"
  - Submitted at: ${u.createdAt.toISOString()}`;
    })
    .join("\n\n");

  const prompt = `You are a crisis management AI assistant. Two volunteers have submitted conflicting status changes for the same crisis event within 5 minutes. Analyze the conflicting updates against the existing timeline and volunteer reputation to recommend which update is more likely correct.

CRISIS EVENT:
- Title: ${crisis.title}
- Type: ${crisis.incidentType}
- Location: ${crisis.locationText || "unknown"}
- Current status: ${crisis.status}

EXISTING TIMELINE (most recent first):
${timelineContext || "No prior updates."}

CONFLICTING UPDATES:
${conflictDescriptions}

Based on:
1. Which update is more consistent with the existing timeline evidence?
2. Which volunteer has higher reputation (points, verified hours, badges)?
3. Which proposed status is more plausible given the crisis type and current status?
4. Are there any red flags in either update (vague notes, unrealistic transitions)?

Respond in JSON format:
{
  "recommendedUpdateIndex": <1-based index of the recommended update>,
  "recommendation": "<one paragraph summary of which update to trust>",
  "reasoning": "<detailed reasoning considering timeline, reputation, and plausibility>"
}`;

  try {
    const aiResponse = await generateText(prompt, {
      maxTokens: 16000,
      temperature: 0.3,
      reasoning: "none"
    });

    // Parse the AI response
    let parsed: { recommendedUpdateIndex?: number; recommendation?: string; reasoning?: string };
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = { recommendation: aiResponse.slice(0, 500) };
    }

    const recommendedIndex = (parsed.recommendedUpdateIndex ?? 1) - 1;
    const recommendedUpdate = conflictingUpdates[Math.min(Math.max(recommendedIndex, 0), conflictingUpdates.length - 1)];

    // Store the conflict resolution
    await prisma.conflictResolution.create({
      data: {
        crisisEventId,
        updateIds: conflictingUpdates.map((u) => u.id),
        recommendation: parsed.recommendation ?? "AI analysis completed but could not generate recommendation.",
        recommendedUpdateId: recommendedUpdate?.id ?? null,
        reasoning: parsed.reasoning ?? null
      }
    });

    console.log(`[conflict-resolution] AI analyzed ${conflictingUpdates.length} conflicting updates for crisis ${crisisEventId}`);
  } catch (err) {
    console.error("[conflict-resolution] AI analysis failed:", err);
  }
}

/**
 * List unresolved conflict resolutions for admin review.
 */
export async function getUnresolvedConflicts(crisisEventId?: string): Promise<{
  id: string;
  crisisEventId: string;
  crisisTitle: string;
  recommendation: string;
  reasoning: string | null;
  recommendedUpdateId: string | null;
  updateIds: string[];
  resolved: boolean;
  createdAt: string;
}[]> {
  const conflicts = await prisma.conflictResolution.findMany({
    where: {
      ...(crisisEventId ? { crisisEventId } : {}),
      resolved: false
    },
    include: {
      crisisEvent: { select: { title: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return conflicts.map((c) => ({
    id: c.id,
    crisisEventId: c.crisisEventId,
    crisisTitle: c.crisisEvent.title,
    recommendation: c.recommendation,
    reasoning: c.reasoning,
    recommendedUpdateId: c.recommendedUpdateId,
    updateIds: c.updateIds,
    resolved: c.resolved,
    createdAt: c.createdAt.toISOString()
  }));
}

/**
 * Admin resolves a conflict by choosing which update to accept.
 * The chosen update is unflagged and applied; the others are dismissed.
 */
export async function resolveConflict(
  conflictId: string,
  acceptedUpdateId: string,
  adminId: string
): Promise<void> {
  const conflict = await prisma.conflictResolution.findUnique({
    where: { id: conflictId },
    include: { crisisEvent: { select: { status: true } } }
  });

  if (!conflict) throw new SafeError("Conflict resolution not found");
  if (conflict.resolved) throw new SafeError("Conflict already resolved");

  const rejectedUpdateIds = conflict.updateIds.filter((id) => id !== acceptedUpdateId);

  await prisma.$transaction(async (tx) => {
    // Unflag the accepted update and apply its status change
    const accepted = await tx.crisisEventUpdate.findUnique({
      where: { id: acceptedUpdateId },
      select: { newStatus: true, previousStatus: true }
    });

    if (accepted && accepted.newStatus !== accepted.previousStatus) {
      await tx.crisisEvent.update({
        where: { id: conflict.crisisEventId },
        data: { status: accepted.newStatus, version: { increment: 1 } }
      });
    }

    await tx.crisisEventUpdate.update({
      where: { id: acceptedUpdateId },
      data: { isFlagged: false }
    });

    // Dismiss the rejected updates
    if (rejectedUpdateIds.length > 0) {
      await tx.crisisEventUpdate.updateMany({
        where: { id: { in: rejectedUpdateIds } },
        data: {
          isFlagged: false,
          dismissedById: adminId,
          dismissedAt: new Date()
        }
      });
    }

    // Mark the conflict as resolved
    await tx.conflictResolution.update({
      where: { id: conflictId },
      data: {
        resolved: true,
        resolvedById: adminId,
        resolvedAt: new Date()
      }
    });
  });

  await refreshSituationSummary(conflict.crisisEventId);
}

