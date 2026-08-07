/**
 * Situation Brief Service — versioned, deterministic situation reports.
 * A published brief is immutable; corrections create a superseding version.
 *
 * Per refinement plan §14.7:
 *   - Stale-brief warning when the latest published brief is older than
 *     30 minutes, indicating a possible provider outage.
 *   - AI enhancement status is recorded in the brief's changedFacts array
 *     as a metadata string (since the schema cannot be changed here).
 */

import { prisma } from "../lib/prisma.js";
import { generateText } from "./aiService.js";
import { stripThinkingTags } from "../utils/sanitize.js";
import { metrics } from "../utils/metrics.js";
import { SafeError } from "../utils/SafeError.js";

/** Threshold (in ms) beyond which a published brief is considered stale. */
const STALE_BRIEF_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/** Metadata marker stored in changedFacts when AI enhancement was skipped. */
const AI_SKIPPED_MARKER = "[META:ai_enhanced=false]";

export interface BriefResult {
  id: string;
  version: number;
  status: string;
  cutOffAt: Date;
  content: string;
  changedFacts: string[];
  unresolvedConflicts: string[];
  sourceClaimIds: string[];
  generatedBy: { id: string; fullName: string };
  reviewedBy: { id: string; fullName: string } | null;
  publishedAt: Date | null;
}

/**
 * Generate a new draft situation brief for a crisis.
 * Includes only verified claims (not SINGLE_SOURCE or CONFLICTED).
 * Calls LLM summarization only as a secondary step.
 */
export async function generateBrief(
  crisisEventId: string,
  userId: string
): Promise<BriefResult> {
  const startTime = Date.now();

  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    include: {
      updates: {
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
          updater: { select: { fullName: true } }
        }
      },
      responders: {
        include: {
          volunteer: { select: { fullName: true } }
        },
        take: 500
      }
    }
  });

  if (!crisis) throw new SafeError("Crisis event not found");

  // Gather verified claims
  const claims = await prisma.claim.findMany({
    where: {
      crisisEventId,
      evidenceState: { in: ["CORROBORATED", "COORDINATOR_VERIFIED", "OFFICIAL_CONFIRMED"] }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  // Find contradictions
  const contradictions = await prisma.evidenceEdge.findMany({
    where: {
      fromClaim: { crisisEventId },
      edgeType: "CONTRADICTS"
    },
    include: {
      fromClaim: { select: { subject: true, value: true } },
      toClaim: { select: { subject: true, value: true } }
    },
    take: 100
  });

  // Compute metrics deterministically
  const responders = crisis.responders;
  const activeResponders = responders.filter((r: any) => ["RESPONDING", "EN_ROUTE", "ON_SITE"].includes(r.status));

  // Build deterministic content first (before AI)
  const deterministicContent = [
    `# Situation Brief: ${crisis.title}`,
    ``,
    `**Status:** ${crisis.status}`,
    `**Severity:** ${crisis.severityLevel}`,
    `**Location:** ${crisis.locationText}`,
    `**Generated:** ${new Date().toISOString()}`,
    ``,
    `## Active Responders`,
    `Total: ${responders.length}, Active: ${activeResponders.length}`,
    ...activeResponders.map((r: any) => `- ${r.volunteer.fullName} (${r.status})`),
    ``,
    `## Verified Claims`,
    ...claims.map((c: any) => `- **${c.claimType}** ${c.subject}: ${c.value} *(state: ${c.evidenceState})*`),
    ``,
    ...(contradictions.length > 0 ? [
      `## Unresolved Contradictions`,
      ...contradictions.map((c: any) => `- ${c.fromClaim.subject}: "${c.fromClaim.value}" vs "${c.toClaim.value}"`)
    ] : [])
  ].join("\n");

  // Try AI enhancement (optional, secondary)
  let aiContent: string | null = null;
  let aiEnhanced = false;
  try {
    const prompt = `Based on this verified situation data, write a 3-sentence executive summary for emergency coordinators:

${deterministicContent}

Requirements:
- Exactly 3 sentences, each under 20 words
- No headings, no bullet points, plain prose only
- Focus on: what happened, current state, what needs attention
- Do not add facts not in the source data`;

    const raw = await generateText(prompt, { maxTokens: 16000, temperature: 0.3, reasoning: "none" });
    aiContent = stripThinkingTags(raw.trim());
    aiEnhanced = true;
  } catch (err) {
    // AI unavailable — deterministic content is the fallback
    console.log("[brief] AI enhancement skipped:", (err as any)?.message);
  }

  const finalContent = aiContent ? `${aiContent}\n\n---\n\n${deterministicContent}` : deterministicContent;

  // Resolve version number
  const lastBrief = await prisma.situationBrief.findFirst({
    where: { crisisEventId },
    orderBy: { version: "desc" },
    select: { version: true }
  });
  const nextVersion = (lastBrief?.version ?? 0) + 1;

  const brief = await prisma.situationBrief.create({
    data: {
      crisisEventId,
      version: nextVersion,
      status: "DRAFT",
      cutOffAt: new Date(),
      content: finalContent,
      changedFacts: aiEnhanced ? [] : [AI_SKIPPED_MARKER],
      unresolvedConflicts: contradictions.map((c: any) =>
        `${c.fromClaim.subject}: ${c.fromClaim.value} vs ${c.toClaim.value}`
      ),
      sourceClaimIds: claims.map((c: any) => c.id),
      generatedById: userId
    },
    include: {
      generatedBy: { select: { id: true, fullName: true } },
      reviewedBy: { select: { id: true, fullName: true } }
    }
  });

  // §15.4: Record brief generation latency metric
  metrics.recordBriefGeneration(Date.now() - startTime);

  return brief as unknown as BriefResult;
}

/**
 * Listbriefs for a crisis.
 */
export async function getBriefsForCrisis(crisisEventId: string) {
  return prisma.situationBrief.findMany({
    where: { crisisEventId },
    orderBy: { version: "desc" },
    take: 50,
    include: {
      generatedBy: { select: { id: true, fullName: true } },
      reviewedBy: { select: { id: true, fullName: true } }
    }
  });
}

/**
 * Coordinator reviews and publishes a brief.
 */
export async function publishBrief(
  briefId: string,
  reviewerId: string,
  note?: string
): Promise<BriefResult> {
  // Wrap in a transaction to ensure the supersede and publish happen atomically,
  // preventing two concurrent publishes from both ending up PUBLISHED.
  const updated = await prisma.$transaction(async (tx) => {
    const brief = await tx.situationBrief.findUnique({ where: { id: briefId } });
    if (!brief) throw new SafeError("Brief not found");
    if (brief.status === "PUBLISHED") throw new SafeError("Brief is already published");

    // Mark any previous published brief as superseded
    await tx.situationBrief.updateMany({
      where: { crisisEventId: brief.crisisEventId, status: "PUBLISHED" },
      data: { status: "SUPERSEDED" }
    });

    const result = await tx.situationBrief.update({
      where: { id: briefId },
      data: {
        status: "PUBLISHED",
        reviewedById: reviewerId,
        publishedAt: new Date(),
        changedFacts: note ? [note] : brief.changedFacts
      },
      include: {
        generatedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } }
      }
    });

    return result;
  });

  const { logAuditEvent } = await import("./auditService.js");
  await logAuditEvent({
    actorId: reviewerId,
    actorRole: "ADMIN",
    action: "BRIEF_PUBLISHED",
    targetType: "SituationBrief",
    targetId: briefId,
    afterJson: JSON.stringify({ version: updated.version })
  });

  return updated as unknown as BriefResult;
}

/**
 * Review a brief (add note, mark as reviewed but not published).
 */
export async function reviewBrief(
  briefId: string,
  reviewerId: string,
  note: string
): Promise<BriefResult> {
  const existing = await prisma.situationBrief.findUnique({ where: { id: briefId } });
  if (!existing) throw new SafeError("Brief not found");

  const brief = await prisma.situationBrief.update({
    where: { id: briefId },
    data: {
      status: "REVIEWED",
      reviewedById: reviewerId,
      changedFacts: [...(existing.changedFacts ?? []), note]
    },
    include: {
      generatedBy: { select: { id: true, fullName: true } },
      reviewedBy: { select: { id: true, fullName: true } }
    }
  });

  return brief as unknown as BriefResult;
}

/**
 * Get the most recent PUBLISHED brief for a crisis event.
 * Returns null if no published brief exists.
 *
 * Per refinement plan §14.7.
 */
export async function getLatestPublishedBrief(crisisEventId: string) {
  return prisma.situationBrief.findFirst({
    where: { crisisEventId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      generatedBy: { select: { id: true, fullName: true } },
      reviewedBy: { select: { id: true, fullName: true } }
    }
  });
}

/**
 * Stale-brief warning result.
 * Per refinement plan §14.7: when the latest published brief is older than
 * 30 minutes, the UI should warn coordinators that the brief may be stale
 * (e.g. due to an AI provider outage or processing delay).
 */
export interface StaleBriefWarning {
  brief: Awaited<ReturnType<typeof getLatestPublishedBrief>>;
  isStale: boolean;
  staleReason: string | null;
}

/**
 * Check whether the latest published brief for a crisis is stale.
 *
 * A brief is considered stale if:
 *   - It was published more than 30 minutes ago, OR
 *   - It was generated without AI enhancement (provider outage)
 *
 * Per refinement plan §14.7.
 */
export async function getStaleBriefWarning(
  crisisEventId: string
): Promise<StaleBriefWarning> {
  const brief = await getLatestPublishedBrief(crisisEventId);

  if (!brief) {
    return {
      brief: null,
      isStale: false,
      staleReason: null,
    };
  }

  const publishedAt = brief.publishedAt ?? brief.cutOffAt;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const reasons: string[] = [];

  if (ageMs > STALE_BRIEF_THRESHOLD_MS) {
    const ageMinutes = Math.floor(ageMs / 60000);
    reasons.push(
      `Latest brief was published ${ageMinutes} minutes ago (threshold: 30 minutes). ` +
      `The situation may have changed — consider generating a new brief.`
    );
  }

  // Check if the brief was generated without AI enhancement
  const changedFacts = brief.changedFacts ?? [];
  if (changedFacts.includes(AI_SKIPPED_MARKER)) {
    reasons.push(
      "This brief was generated without AI enhancement (provider may have been unavailable). " +
      "The executive summary may be missing — consider regenerating."
    );
  }

  return {
    brief,
    isStale: reasons.length > 0,
    staleReason: reasons.length > 0 ? reasons.join(" ") : null,
  };
}

export interface VelocityMetrics {
  claimsLastHour: number;
  claimsPrevHour: number;
  velocitySurgePercent: number;
  escalationRiskScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  predictiveSummary: string;
}

export async function calculateVelocityAndRisk(crisisEventId: string): Promise<VelocityMetrics> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const [claimsLastHour, claimsPrevHour, unmetNeedsCount, activeRespondersCount, criticalClaimsCount] = await Promise.all([
    prisma.claim.count({
      where: { crisisEventId, createdAt: { gte: oneHourAgo } }
    }),
    prisma.claim.count({
      where: { crisisEventId, createdAt: { gte: twoHoursAgo, lt: oneHourAgo } }
    }),
    prisma.need.count({
      where: { crisisEventId, isMet: false }
    }),
    prisma.crisisResponder.count({
      where: { crisisEventId, status: { in: ["RESPONDING", "EN_ROUTE", "ON_SITE"] } }
    }),
    prisma.claim.count({
      where: {
        crisisEventId,
        OR: [
          { subject: { contains: "casualty", mode: "insensitive" } },
          { subject: { contains: "trapped", mode: "insensitive" } },
          { subject: { contains: "collapsed", mode: "insensitive" } },
          { subject: { contains: "overflow", mode: "insensitive" } },
          { subject: { contains: "medical", mode: "insensitive" } },
        ]
      }
    })
  ]);

  let velocitySurgePercent = 0;
  if (claimsPrevHour === 0) {
    velocitySurgePercent = claimsLastHour > 0 ? claimsLastHour * 100 : 0;
  } else {
    velocitySurgePercent = Math.round(((claimsLastHour - claimsPrevHour) / claimsPrevHour) * 100);
  }

  let riskScore = 20;
  if (velocitySurgePercent > 100) riskScore += 30;
  else if (velocitySurgePercent > 50) riskScore += 20;
  else if (velocitySurgePercent > 0) riskScore += 10;

  if (unmetNeedsCount > activeRespondersCount * 2) riskScore += 25;
  else if (unmetNeedsCount > activeRespondersCount) riskScore += 15;

  if (criticalClaimsCount > 5) riskScore += 25;
  else if (criticalClaimsCount > 0) riskScore += 15;

  riskScore = Math.min(100, Math.max(0, riskScore));

  let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
  if (riskScore >= 80) riskLevel = "CRITICAL";
  else if (riskScore >= 60) riskLevel = "HIGH";
  else if (riskScore >= 40) riskLevel = "MODERATE";

  let predictiveSummary = `Report intake velocity is stable. Response capacity matches active needs.`;
  if (riskLevel === "CRITICAL") {
    predictiveSummary = `High claim velocity surge (+${velocitySurgePercent}%) and severe needs deficit detected. High probability of operational bottleneck within 3 hours.`;
  } else if (riskLevel === "HIGH") {
    predictiveSummary = `Elevated report intake velocity with ${unmetNeedsCount} unmet needs. Additional responder dispatch recommended to prevent escalation.`;
  } else if (riskLevel === "MODERATE") {
    predictiveSummary = `Moderate activity level. Monitoring claim updates and responder deployment progress.`;
  }

  return {
    claimsLastHour,
    claimsPrevHour,
    velocitySurgePercent,
    escalationRiskScore: riskScore,
    riskLevel,
    predictiveSummary
  };
}
