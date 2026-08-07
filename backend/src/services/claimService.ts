/**
 * Claims Service — Evidence Graph + Contradiction Radar
 *
 * Extracts typed claims from incident reports using Groq AI (structured JSON),
 * stores them with source provenance, and detects/supports/contradicts edges
 * between claims using deterministic rules.
 *
 * Every claim always carries: sourceRecordIds, evidenceState, and needsHumanDecision.
 */

import type { ClaimType, EvidenceState, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { stripThinkingTagsFromJson } from "../utils/sanitize.js";
import { generateText } from "./aiService.js";
import { SafeError } from "../utils/SafeError.js";

// ── AI Provider Metadata ────────────────────────────────────────────────────

const AI_PROVIDER = "groq";
const AI_MODEL = env.groqQwenModel;
const PROMPT_VERSION = "claim-extraction-v1";

// ── Constants ────────────────────────────────────────────────────────────────

const CLAIM_EXTRACTION_PROMPT = `You are a claim extraction engine for a crisis response platform.

Given an incident report, extract structured claims about the situation.

Return ONLY a JSON array. Each element has these exact fields:
- claimType: one of "ROAD_ACCESS" | "CASUALTY_ESTIMATE" | "RESOURCE_NEED" | "DAMAGE_ASSESSMENT" | "HAZARD_STATUS" | "LOCATION_UPDATE" | "OTHER"
- subject: the specific entity the claim is about (a road name, location name, resource type, etc.)
- value: the claimed state or quantity (e.g. "BLOCKED", "OPEN", "~50 people", "BLOCKED")
- unit: optional unit (people, boats, liters, etc.)
- observedAt: ISO timestamp of when this was observed (if stated, else omit)
- sourceText: the exact sentence or phrase from the report that generated this claim

Rules:
- Only extract claims that are explicitly stated in the report
- If value is a number or quantity, include unit
- claimType must be one of the listed values
- If report mentions a specific road/location as blocked/open, type is ROAD_ACCESS
- If report mentions people trapped/injured/dead, type is CASUALTY_ESTIMATE
- If report mentions needed supplies/services, type is RESOURCE_NEED
- Return empty array [] if no claims can be extracted
- Return ONLY the JSON array. No markdown fences, no explanation.`;

// ── Types ────────────────────────────────────────────────────────────────────

export type ExtractedClaim = {
  claimType: string;
  subject: string;
  value: string;
  unit?: string;
  observedAt?: string;
  sourceText?: string;
};

export type ClaimWithRelations = Prisma.ClaimGetPayload<{
  include: {
    createdBy: { select: { fullName: true; avatarUrl: true } };
    incidentReport: { select: { id: true; incidentTitle: true } };
    edgesFrom: {
      include: {
        toClaim: { select: { id: true; claimType: true; value: true; evidenceState: true } };
        createdBy: { select: { fullName: true } };
      };
    };
    edgesTo: {
      include: {
        fromClaim: { select: { id: true; claimType: true; value: true; evidenceState: true } };
        createdBy: { select: { fullName: true } };
      };
    };
  };
}>;

// ── Claim Extraction ──────────────────────────────────────────────────────────

/**
 * Extract structured claims from a plain-text incident description using Groq.
 * Returns extracted claims + any edges (conflicts found) that were detected.
 */
export async function extractClaimsFromText(
  reportId: string,
  description: string,
  reporterId: string
): Promise<ExtractedClaim[]> {
  const startTime = Date.now();
  let extractedClaims: ExtractedClaim[] = [];
  let errorMessage: string | null = null;
  let attempt = 0;
  const MAX_RETRIES = 1; // AC-03.2: retry once, then send to manual review

  // AC-03.2: Schema-invalid output retried once, then sent to manual review
  while (attempt <= MAX_RETRIES) {
    try {
      const raw = await generateText(CLAIM_EXTRACTION_PROMPT + "\n\n" + description, {
        maxTokens: 16000,
        temperature: 0,
        reasoning: "none"
      });

      const cleaned = stripThinkingTagsFromJson(raw);
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        extractedClaims = parsed.filter(
          (c: any): c is ExtractedClaim =>
            typeof c.claimType === "string" &&
            typeof c.subject === "string" &&
            typeof c.value === "string"
        );
      }

      // Valid output — break out of retry loop
      break;
    } catch (err) {
      attempt++;
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[claims] Extraction attempt ${attempt} failed:`, errorMessage);

      if (attempt <= MAX_RETRIES) {
        // Brief delay before retry
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // AC-03.2: After retry exhausted, mark for manual review
      console.error("[claims] All extraction attempts failed — sending to manual review");
    }
  }

  // FR-03: Persist AIAnalysis record for auditability (provider, model, latency, output)
  // AC-03.2: State is NEEDS_REVIEW when extraction failed after retry
  const finalState = errorMessage ? "MANUAL_REVIEW" : "COMPLETED";
  try {
    await prisma.aIAnalysis.create({
      data: {
        incidentReportId: reportId,
        provider: AI_PROVIDER,
        model: AI_MODEL,
        promptVersion: PROMPT_VERSION,
        inputSourceIds: [reportId],
        outputJson: JSON.stringify(extractedClaims),
        state: finalState,
        errorMessage,
        latencyMs: Date.now() - startTime,
        completedAt: errorMessage ? null : new Date()
      }
    });
  } catch (err) {
    console.error("[claims] Failed to persist AIAnalysis record:", err);
  }

  return extractedClaims;
}

// ── Persist Claims ────────────────────────────────────────────────────────────

/**
 * Persist extracted claims to the database.
 * doom handles both the Claim creation and any automatic edge detection.
 */
export async function persistClaims(
  crisisEventId: string,
  incidentReportId: string,
  extracted: ExtractedClaim[],
  reporterId: string,
  description: string
): Promise<string[]> {
  // Source independence group: reporterId + 5-minute window.
  // Claims from the same reporter within 5 minutes are treated as a single source
  // (they likely saw the same thing and reported it once).
  const independenceGroup = computeSourceIndependenceGroup(reporterId, new Date());

  // Wrap claim creation + edge detection in a transaction so that a failure
  // partway through does not leave the system in a partially-persisted state.
  return prisma.$transaction(async (tx) => {
    const claimIds: string[] = [];

    for (const extracted_ of extracted) {
      const claimType = validateClaimType(extracted_.claimType);
      if (!claimType) continue;

      const claim = await tx.claim.create({
        data: {
          claimType,
          subject: extracted_.subject,
          value: extracted_.value,
          unit: extracted_.unit ?? null,
          locationText: null,
          observedAt: extracted_.observedAt ? new Date(extracted_.observedAt) : null,
          crisisEventId,
          incidentReportId,
          sourceText: extracted_.sourceText ?? null,
          sourceRecordIds: [incidentReportId],
          sourceIndependenceGroup: independenceGroup,
          evidenceState: "SINGLE_SOURCE",
          needsHumanDecision: true,
          createdById: reporterId
        }
      });

      claimIds.push(claim.id);

      // Detect contradictions or supports against existing claims in the same crisis
      await detectClaimEdges(claim, crisisEventId, tx);
    }

    return claimIds;
  });
}

/**
 * Compute a source independence group key.
 * Two claims are independent only if they come from different reporters
 * OR from the same reporter more than 5 minutes apart.
 * Format: reporterId:floor(timestamp / 5min)
 */
function computeSourceIndependenceGroup(reporterId: string, timestamp: Date): string {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const window = Math.floor(timestamp.getTime() / FIVE_MINUTES_MS);
  return `${reporterId}:${window}`;
}

// ── Edge Detection (Deterministic Contradiction Checking) ───────────────────

/**
 * Scan the crisis's existing claims and create edges (SUPPORTS / CONTRADICTS /
 * SUPERSEDES / DUPLICATES) between this new claim and any existing claims.
 * All edges are marked needsHumanDecision=true for coordinator review.
 */
async function detectClaimEdges(
  newClaim: { id: string; claimType: ClaimType; subject: string; value: string; observedAt: Date | null; sourceIndependenceGroup?: string | null },
  crisisEventId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const existingClaims = await tx.claim.findMany({
    where: {
      crisisEventId,
      claimType: newClaim.claimType,
      id: { not: newClaim.id }
    },
    select: { id: true, subject: true, value: true, observedAt: true, claimType: true, sourceIndependenceGroup: true },
    orderBy: { createdAt: "desc" },
    take: 500
  });

  const subject = normalizeSubject(newClaim.subject);

  for (const existing of existingClaims) {
    const existingSubject = normalizeSubject(existing.subject);
    if (subject !== existingSubject) continue; // different subjects — skip

    // Check for contradictions on the same subject+type
    const edge = detectEdgeType(
      { claimType: newClaim.claimType, value: newClaim.value, observedAt: newClaim.observedAt },
      { claimType: existing.claimType ?? newClaim.claimType, value: existing.value, observedAt: existing.observedAt }
    );

    if (edge) {
      // For SUPPORTS edges, only count as independent support if from a different independence group
      const isIndependentSource =
        !newClaim.sourceIndependenceGroup ||
        !existing.sourceIndependenceGroup ||
        newClaim.sourceIndependenceGroup !== existing.sourceIndependenceGroup;

      // If same source group and it's a SUPPORTS, downgrade to DUPLICATES (not independent corroboration)
      if (edge.type === "SUPPORTS" && !isIndependentSource) {
        await tx.evidenceEdge.create({
          data: {
            fromClaimId: newClaim.id,
            toClaimId: existing.id,
            edgeType: "DUPLICATES",
            reason: "Same source within independence window — not independent corroboration",
            createdById: newClaim.id
          }
        });
        continue; // don't upgrade evidence state for duplicate-source claims
      }

      await tx.evidenceEdge.create({
        data: {
          fromClaimId: newClaim.id,
          toClaimId: existing.id,
          edgeType: edge.type,
          reason: edge.reason,
          createdById: newClaim.id // the actor who created the new claim
        }
      });

      // If contradiction detected, flag both claims as CONFLICTED
      if (edge.type === "CONTRADICTS") {
        await tx.claim.updateMany({
          where: { id: { in: [newClaim.id, existing.id] } },
          data: { evidenceState: "CONFLICTED", conflictCount: { increment: 1 } }
        });
      } else if (edge.type === "SUPPORTS") {
        // Only upgrade to CORROBORATED if we have 3+ independent sources supporting
        // Upgrade SINGLE_SOURCE claims to PARTIALLY_CORROBORATED when supported
        await tx.claim.updateMany({
          where: { id: { in: [newClaim.id, existing.id] }, evidenceState: "SINGLE_SOURCE" },
          data: {
            supportCount: { increment: 1 },
            evidenceState: "PARTIALLY_CORROBORATED"
          }
        });
        // For already-corroborated claims, just increment support count
        await tx.claim.updateMany({
          where: { id: { in: [newClaim.id, existing.id] }, evidenceState: { not: "SINGLE_SOURCE" } },
          data: { supportCount: { increment: 1 } }
        });

        // Check if support count reaches CORROBORATED threshold (3+ independent supports)
        for (const claimId of [newClaim.id, existing.id]) {
          const updated = await tx.claim.findUnique({
            where: { id: claimId },
            select: { supportCount: true, evidenceState: true }
          });
          if (updated && updated.supportCount >= 3 && updated.evidenceState === "PARTIALLY_CORROBORATED") {
            await tx.claim.update({
              where: { id: claimId },
              data: { evidenceState: "CORROBORATED" }
            });
          }
        }
      }
    }
  }
}

type EdgeType = "SUPPORTS" | "CONTRADICTS" | "SUPERSEDES";

/**
 * Deterministic edge detection — rule-based, no LLM needed.
 * These are conservative, human-interpretable rules.
 *
 * Typed contradictions (per refinement plan §10.7):
 * - road OPEN vs BLOCKED at overlapping time
 * - number estimate ranges with material disagreement (3x)
 * - HAZARD_STATUS opposing values (flooded vs dry, active vs contained)
 * - DAMAGE_ASSESSMENT opposing values (intact vs destroyed)
 * - RESOURCE_NEED: MET vs UNMET
 *
 * Time-aware supersession: "road open at 08:00" and "road blocked at 10:00"
 * may represent a change, not misinformation. If observedAt differs by >30min,
 * we treat it as SUPERSEDES instead of CONTRADICTS.
 */
function detectEdgeType(
  a: { claimType: ClaimType; value: string; observedAt: Date | null },
  b: { claimType: ClaimType; value: string; observedAt: Date | null }
): { type: EdgeType; reason: string } | null {
  // TIME-AWARE SUPERSEDES: if both have observation times and differ by >30 minutes,
  // the newer one supersedes the older one (situation changed, not a contradiction)
  if (a.observedAt && b.observedAt) {
    const diffMs = Math.abs(a.observedAt.getTime() - b.observedAt.getTime());
    const THIRTY_MINUTES = 30 * 60 * 1000;
    if (diffMs > THIRTY_MINUTES) {
      if (a.observedAt > b.observedAt) {
        return {
          type: "SUPERSEDES",
          reason: `Newer observation (${a.observedAt.toISOString()}) supersedes older (${b.observedAt.toISOString()}) — situation likely changed`
        };
      }
      // If b is newer, we still return null from a's perspective (b's edge creation will handle it)
      // But since we're comparing new vs existing, a is always the new claim
    }
  }

  // CONTRADICTS: ROAD_ACCESS with opposing values (road OPEN vs BLOCKED)
  if (a.claimType === "ROAD_ACCESS") {
    const opp = getOpposingValue(a.value, b.value);
    if (opp) {
      return {
        type: "CONTRADICTS",
        reason: `Road access conflict: ${a.value} vs ${b.value}`
      };
    }
  }

  // CONTRADICTS: HAZARD_STATUS with opposing values (flooded vs dry, active vs contained)
  if (a.claimType === "HAZARD_STATUS") {
    const opp = getOpposingValue(a.value, b.value);
    if (opp) {
      return {
        type: "CONTRADICTS",
        reason: `Hazard status conflict: ${a.value} vs ${b.value}`
      };
    }
  }

  // CONTRADICTS: DAMAGE_ASSESSMENT with opposing values (intact vs destroyed)
  if (a.claimType === "DAMAGE_ASSESSMENT") {
    const opp = getOpposingValue(a.value, b.value);
    if (opp) {
      return {
        type: "CONTRADICTS",
        reason: `Damage assessment conflict: ${a.value} vs ${b.value}`
      };
    }
  }

  // CONTRADICTS: CASUALTY_ESTIMATE numbers that differ significantly (3x or more)
  if (a.claimType === "CASUALTY_ESTIMATE") {
    const numA = extractNumber(a.value);
    const numB = extractNumber(b.value);
    if (numA != null && numB != null) {
      const ratio = Math.max(numA, numB) / Math.min(numA, numB);
      if (ratio >= 3) {
        return {
          type: "CONTRADICTS",
          reason: `Casualty estimate ${numA} vs ${numB} differs 3x or more`
        };
      }
    }
  }

  // CONTRADICTS: RESOURCE_NEED with opposing states (MET vs UNMET, AVAILABLE vs SHORTAGE)
  if (a.claimType === "RESOURCE_NEED") {
    const needOpp = getNeedOpposingValue(a.value, b.value);
    if (needOpp) {
      return {
        type: "CONTRADICTS",
        reason: `Resource need conflict: ${a.value} vs ${b.value}`
      };
    }
  }

  // SUPPORTS: same value on same subject+type
  if (a.value.toUpperCase() === b.value.toUpperCase()) {
    return { type: "SUPPORTS", reason: "Same value reported from independent sources" };
  }

  return null;
}

function getOpposingValue(val1: string, val2: string): string | null {
  const pairs: [string, string][] = [
    // Road access
    ["BLOCKED", "OPEN"],
    ["BLOCKED", "PASSABLE"],
    ["CLOSED", "OPEN"],
    // Hazard status
    ["FLOODED", "DRY"],
    ["ACTIVE", "CONTAINED"],
    ["ACTIVE", "RESOLVED"],
    ["SPREADING", "CONTAINED"],
    // Damage assessment
    ["DAMAGED", "INTACT"],
    ["DESTROYED", "INTACT"],
    ["DESTROYED", "MINIMAL"],
    ["COLLAPSED", "STANDING"]
  ];
  const v1 = val1.toUpperCase();
  const v2 = val2.toUpperCase();
  for (const [a, b] of pairs) {
    if ((v1.includes(a) && v2.includes(b)) || (v1.includes(b) && v2.includes(a))) {
      return `${val1} vs ${val2}`;
    }
  }
  return null;
}

/**
 * Detect opposing resource need states: MET vs UNMET, AVAILABLE vs SHORTAGE
 */
function getNeedOpposingValue(val1: string, val2: string): string | null {
  const pairs: [string, string][] = [
    ["MET", "UNMET"],
    ["AVAILABLE", "SHORTAGE"],
    ["AVAILABLE", "SCARCE"],
    ["SUPPLIED", "NEEDED"],
    ["FULFILLED", "PENDING"]
  ];
  const v1 = val1.toUpperCase();
  const v2 = val2.toUpperCase();
  for (const [a, b] of pairs) {
    if ((v1.includes(a) && v2.includes(b)) || (v1.includes(b) && v2.includes(a))) {
      return `${val1} vs ${val2}`;
    }
  }
  return null;
}

function extractNumber(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function validateClaimType(value: string): ClaimType | null {
  const valid: ClaimType[] = [
    "ROAD_ACCESS", "CASUALTY_ESTIMATE", "RESOURCE_NEED",
    "DAMAGE_ASSESSMENT", "HAZARD_STATUS", "LOCATION_UPDATE", "OTHER"
  ];
  return valid.includes(value as ClaimType) ? (value as ClaimType) : null;
}

function normalizeSubject(subject: string): string {
  return subject.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// ── Query Claims for a Crisis ────────────────────────────────────────────────

export type ClaimsQueryResult = {
  claims: ClaimWithRelations[];
  contradictions: Array<{ fromClaim: any; toClaim: any; reason: string }>;
  summary: {
    total: number;
    byState: Record<EvidenceState, number>;
    byType: Record<ClaimType, number>;
  };
};

export async function getClaimsForCrisis(crisisEventId: string): Promise<ClaimsQueryResult> {
  const claims = await prisma.claim.findMany({
    where: { crisisEventId },
    orderBy: [{ supportCount: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      createdBy: { select: { fullName: true, avatarUrl: true } },
      incidentReport: { select: { id: true, incidentTitle: true } },
      edgesFrom: {
        include: {
          toClaim: { select: { id: true, claimType: true, value: true, evidenceState: true } },
          createdBy: { select: { fullName: true } }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      },
      edgesTo: {
        include: {
          fromClaim: { select: { id: true, claimType: true, value: true, evidenceState: true } },
          createdBy: { select: { fullName: true } }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  // Find all contradiction edges
  const contradictionEdges = await prisma.evidenceEdge.findMany({
    where: {
      fromClaim: { crisisEventId },
      edgeType: "CONTRADICTS"
    },
    include: {
      fromClaim: { select: { id: true, claimType: true, subject: true, value: true } },
      toClaim: { select: { id: true, claimType: true, subject: true, value: true } }
    },
    take: 500,
    orderBy: { createdAt: "desc" }
  });

  // Summary stats
  const byState: Record<EvidenceState, number> = {} as any;
  const byType: Record<ClaimType, number> = {} as any;
  for (const c of claims) {
    byState[c.evidenceState] = (byState[c.evidenceState] ?? 0) + 1;
    byType[c.claimType] = (byType[c.claimType] ?? 0) + 1;
  }

  const contradictions = contradictionEdges.map((e) => ({
    fromClaim: e.fromClaim,
    toClaim: e.toClaim,
    reason: e.reason ?? "Value conflict"
  }));

  return {
    claims: claims as unknown as ClaimWithRelations[],
    contradictions,
    summary: { total: claims.length, byState, byType }
  };
}

// ── Human Decision on a Claim ─────────────────────────────────────────────────

export async function decideClaim(
  claimId: string,
  actorId: string,
  decision: "ACCEPT" | "REJECT" | "SUPERSEDE",
  reason: string,
  supersedeValue?: string
): Promise<void> {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new SafeError("Claim not found");

  await prisma.$transaction(async (tx) => {
    // Record the decision
    await tx.decision.create({
      data: {
        action: mapDecisionAction(decision),
        crisisEventId: claim.crisisEventId,
        claimId,
        actorId,
        reason,
        beforeState: JSON.stringify({
          evidenceState: claim.evidenceState,
          value: claim.value
        }),
        afterState: JSON.stringify({
          evidenceState:
            decision === "ACCEPT"
              ? "COORDINATOR_VERIFIED"
              : decision === "REJECT"
                ? "REJECTED"
                : "STALE"
        })
      }
    });

    // Apply the decision
    if (decision === "ACCEPT") {
      await tx.claim.update({
        where: { id: claimId },
        data: {
          evidenceState: "COORDINATOR_VERIFIED",
          needsHumanDecision: false,
          supersededById: null
        }
      });
    } else if (decision === "REJECT") {
      await tx.claim.update({
        where: { id: claimId },
        data: {
          evidenceState: "REJECTED",
          needsHumanDecision: false
        }
      });
    } else if (decision === "SUPERSEDE" && supersedeValue) {
      // Mark old claim as superseded
      await tx.claim.update({
        where: { id: claimId },
        data: { evidenceState: "STALE", needsHumanDecision: false }
      });
      // Create a new superseding claim
      const newClaim = await tx.claim.create({
        data: {
          claimType: claim.claimType,
          subject: claim.subject,
          value: supersedeValue,
          unit: claim.unit,
          crisisEventId: claim.crisisEventId,
          incidentReportId: claim.incidentReportId,
          evidenceState: "SINGLE_SOURCE",
          createdById: actorId
        }
      });
      await tx.claim.update({
        where: { id: claimId },
        data: { supersededById: newClaim.id }
      });
    }
  });
}

function mapDecisionAction(action: string): "ACCEPT_CLAIM" | "REJECT_CLAIM" | "SUPERSEDE_CLAIM" {
  const map: Record<string, any> = {
    ACCEPT: "ACCEPT_CLAIM",
    REJECT: "REJECT_CLAIM",
    SUPERSEDE: "SUPERSEDE_CLAIM"
  };
  return map[action] ?? "ACCEPT_CLAIM";
}

// ── Evidence Summary (replaces opaque credibility score) ─────────────────────

/**
 * The real evidence summary that replaces the opaque 0-100 credibility score.
 * This is what the UI should display instead of a number.
 */
export type EvidenceSummary = {
  /** The dominant evidence state across all claims for this entity */
  dominantState: EvidenceState;
  /** Human-readable label for the dominant state */
  stateLabel: string;
  /** Number of independent sources (distinct sourceIndependenceGroups) */
  independentSourceCount: number;
  /** Number of claims that support the dominant narrative */
  supportingClaims: number;
  /** Number of claims that contradict the dominant narrative */
  contradictingClaims: number;
  /** Number of claims extracted total */
  totalClaims: number;
  /** Whether a human coordinator has verified any claim */
  coordinatorVerified: boolean;
  /** Whether an official source has confirmed any claim */
  officialConfirmed: boolean;
  /** Time of the most recent claim update (for freshness) */
  lastUpdatedAt: string;
  /** Age of the most recent claim in hours */
  freshnessHours: number;
  /** Whether the evidence is stale (no updates in 24h) */
  isStale: boolean;
  /** Contributing factors — human-readable list of WHY this state was assigned */
  factors: EvidenceFactor[];
  /** Active contradictions with details */
  contradictions: Array<{
    subject: string;
    claimType: string;
    valueA: string;
    valueB: string;
    reason: string;
  }>;
  /** The internal AI diagnostic score (NOT displayed as "truth" — for sorting only) */
  internalDiagnosticScore: number | null;
};

export type EvidenceFactor = {
  label: string;
  detail: string;
  /** "positive" strengthens confidence, "negative" weakens it, "neutral" is informational */
  polarity: "positive" | "negative" | "neutral";
};

const STATE_LABELS: Record<EvidenceState, string> = {
  SINGLE_SOURCE: "Single Source",
  PARTIALLY_CORROBORATED: "Partially Corroborated",
  CORROBORATED: "Corroborated",
  CONFLICTED: "Conflicted",
  COORDINATOR_VERIFIED: "Coordinator Verified",
  OFFICIAL_CONFIRMED: "Official Confirmed",
  REJECTED: "Rejected",
  STALE: "Stale"
};

/**
 * Determine the dominant evidence state from a set of claims.
 * Priority: CONFLICTED > COORDINATOR_VERIFIED > OFFICIAL_CONFIRMED > CORROBORATED > PARTIALLY_CORROBORATED > SINGLE_SOURCE > STALE > REJECTED
 */
function dominantStateFromClaims(claims: { evidenceState: EvidenceState }[]): EvidenceState {
  if (claims.length === 0) return "SINGLE_SOURCE";

  const stateCounts: Record<string, number> = {};
  for (const c of claims) {
    stateCounts[c.evidenceState] = (stateCounts[c.evidenceState] ?? 0) + 1;
  }

  // If ANY claim is CONFLICTED, the dominant state is CONFLICTED
  if (stateCounts["CONFLICTED"] > 0) return "CONFLICTED";
  // If ANY claim is OFFICIAL_CONFIRMED, that's the strongest positive signal
  if (stateCounts["OFFICIAL_CONFIRMED"] > 0) return "OFFICIAL_CONFIRMED";
  // If ANY claim is COORDINATOR_VERIFIED, use that
  if (stateCounts["COORDINATOR_VERIFIED"] > 0) return "COORDINATOR_VERIFIED";
  // Otherwise, use the most common non-negative state
  if (stateCounts["CORROBORATED"] > 0) return "CORROBORATED";
  if (stateCounts["PARTIALLY_CORROBORATED"] > 0) return "PARTIALLY_CORROBORATED";
  if (stateCounts["SINGLE_SOURCE"] > 0) return "SINGLE_SOURCE";
  if (stateCounts["STALE"] > 0) return "STALE";
  if (stateCounts["REJECTED"] > 0) return "REJECTED";

  return "SINGLE_SOURCE";
}

/**
 * Build the contributing factors list — the "why" behind the evidence state.
 */
function buildFactors(
  claims: any[],
  dominantState: EvidenceState,
  independentSourceCount: number,
  contradictions: any[]
): EvidenceFactor[] {
  const factors: EvidenceFactor[] = [];

  // Source independence
  if (independentSourceCount >= 3) {
    factors.push({
      label: `${independentSourceCount} independent sources`,
      detail: "Claims verified by 3 or more independent reporters",
      polarity: "positive"
    });
  } else if (independentSourceCount === 2) {
    factors.push({
      label: "2 independent sources",
      detail: "Claims corroborated by a second independent reporter",
      polarity: "positive"
    });
  } else {
    factors.push({
      label: "Single source",
      detail: "All claims originate from one reporter — not yet independently corroborated",
      polarity: "neutral"
    });
  }

  // Support count
  const totalSupports = claims.reduce((sum, c) => sum + (c.supportCount || 0), 0);
  if (totalSupports > 0 && dominantState !== "CONFLICTED") {
    factors.push({
      label: `${totalSupports} supporting observations`,
      detail: "Other claims in this crisis confirm the same values",
      polarity: "positive"
    });
  }

  // Contradictions
  if (contradictions.length > 0) {
    factors.push({
      label: `${contradictions.length} contradiction${contradictions.length > 1 ? "s" : ""} detected`,
      detail: contradictions.map(c => `${c.subject}: ${c.valueA} vs ${c.valueB}`).join("; "),
      polarity: "negative"
    });
  }

  // Coordinator verification
  const hasCoordinatorVerified = claims.some(c => c.evidenceState === "COORDINATOR_VERIFIED");
  if (hasCoordinatorVerified) {
    factors.push({
      label: "Coordinator verified",
      detail: "A human coordinator has reviewed and accepted at least one claim",
      polarity: "positive"
    });
  }

  // Official confirmation
  const hasOfficialConfirmed = claims.some(c => c.evidenceState === "OFFICIAL_CONFIRMED");
  if (hasOfficialConfirmed) {
    factors.push({
      label: "Official source confirmed",
      detail: "An official or verified responder has confirmed at least one claim",
      polarity: "positive"
    });
  }

  // Needs human decision
  const needsDecision = claims.filter(c => c.needsHumanDecision).length;
  if (needsDecision > 0 && dominantState !== "CONFLICTED") {
    factors.push({
      label: `${needsDecision} claim${needsDecision > 1 ? "s" : ""} awaiting review`,
      detail: "These claims have not yet been reviewed by a coordinator",
      polarity: "neutral"
    });
  }

  return factors;
}

/**
 * Get the evidence summary for a specific incident report.
 * This aggregates all claims extracted from that report.
 */
export async function getReportEvidenceSummary(reportId: string): Promise<EvidenceSummary | null> {
  const claims = await prisma.claim.findMany({
    where: { incidentReportId: reportId },
    orderBy: [{ supportCount: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      edgesFrom: {
        where: { edgeType: "CONTRADICTS" },
        include: {
          toClaim: { select: { id: true, subject: true, claimType: true, value: true } }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (claims.length === 0) {
    return null;
  }

  // Count independent sources
  const independenceGroups = new Set<string>();
  for (const c of claims) {
    if (c.sourceIndependenceGroup) {
      independenceGroups.add(c.sourceIndependenceGroup);
    } else {
      // Fallback: treat each claim as its own source if no group
      independenceGroups.add(c.id);
    }
  }
  const independentSourceCount = independenceGroups.size;

  const dominantState = dominantStateFromClaims(claims);

  // Collect contradictions
  const contradictions: any[] = [];
  for (const claim of claims) {
    for (const edge of claim.edgesFrom) {
      contradictions.push({
        subject: claim.subject,
        claimType: claim.claimType,
        valueA: claim.value,
        valueB: edge.toClaim.value,
        reason: edge.reason ?? "Value conflict"
      });
    }
  }

  const supportingClaims = claims.filter(c => c.supportCount > 1).length;
  const contradictingClaims = claims.filter(c => c.conflictCount > 0).length;
  const coordinatorVerified = claims.some(c => c.evidenceState === "COORDINATOR_VERIFIED");
  const officialConfirmed = claims.some(c => c.evidenceState === "OFFICIAL_CONFIRMED");

  // Freshness
  const lastUpdated = claims.reduce((latest, c) => {
    return c.updatedAt > latest ? c.updatedAt : latest;
  }, claims[0].updatedAt);
  const freshnessHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  const isStale = freshnessHours > 24;

  const factors = buildFactors(claims, dominantState, independentSourceCount, contradictions);

  return {
    dominantState,
    stateLabel: STATE_LABELS[dominantState],
    independentSourceCount,
    supportingClaims,
    contradictingClaims,
    totalClaims: claims.length,
    coordinatorVerified,
    officialConfirmed,
    lastUpdatedAt: lastUpdated.toISOString(),
    freshnessHours: Math.round(freshnessHours * 10) / 10,
    isStale,
    factors,
    contradictions,
    internalDiagnosticScore: null // The AI credibility score is NOT included here — it remains on the report record for internal sorting only
  };
}

/**
 * Get the evidence summary for an entire crisis event.
 * Aggregates all claims across all reports in the crisis.
 */
export async function getCrisisEvidenceSummary(crisisEventId: string): Promise<EvidenceSummary | null> {
  const claims = await prisma.claim.findMany({
    where: { crisisEventId, evidenceState: { not: "REJECTED" } },
    orderBy: [{ supportCount: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      edgesFrom: {
        where: { edgeType: "CONTRADICTS" },
        include: {
          toClaim: { select: { id: true, subject: true, claimType: true, value: true } }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (claims.length === 0) {
    return null;
  }

  const independenceGroups = new Set<string>();
  for (const c of claims) {
    if (c.sourceIndependenceGroup) {
      independenceGroups.add(c.sourceIndependenceGroup);
    } else {
      independenceGroups.add(c.id);
    }
  }
  const independentSourceCount = independenceGroups.size;

  const dominantState = dominantStateFromClaims(claims);

  const contradictions: any[] = [];
  for (const claim of claims) {
    for (const edge of claim.edgesFrom) {
      contradictions.push({
        subject: claim.subject,
        claimType: claim.claimType,
        valueA: claim.value,
        valueB: edge.toClaim.value,
        reason: edge.reason ?? "Value conflict"
      });
    }
  }

  const supportingClaims = claims.filter(c => c.supportCount > 1).length;
  const contradictingClaims = claims.filter(c => c.conflictCount > 0).length;
  const coordinatorVerified = claims.some(c => c.evidenceState === "COORDINATOR_VERIFIED");
  const officialConfirmed = claims.some(c => c.evidenceState === "OFFICIAL_CONFIRMED");

  const lastUpdated = claims.reduce((latest, c) => {
    return c.updatedAt > latest ? c.updatedAt : latest;
  }, claims[0].updatedAt);
  const freshnessHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  const isStale = freshnessHours > 24;

  const factors = buildFactors(claims, dominantState, independentSourceCount, contradictions);

  return {
    dominantState,
    stateLabel: STATE_LABELS[dominantState],
    independentSourceCount,
    supportingClaims,
    contradictingClaims,
    totalClaims: claims.length,
    coordinatorVerified,
    officialConfirmed,
    lastUpdatedAt: lastUpdated.toISOString(),
    freshnessHours: Math.round(freshnessHours * 10) / 10,
    isStale,
    factors,
    contradictions,
    internalDiagnosticScore: null
  };
}
