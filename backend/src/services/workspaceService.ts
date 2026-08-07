import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";

/**
 * FR-05: Get the unified crisis operations workspace data.
 * Returns crisis, claims, needs, assignments, and updates in one response.
 *
 * Performance: All sub-queries are fired in parallel via Promise.all to
 * minimize MongoDB Atlas round-trip latency (each include would otherwise
 * be a sequential query under Prisma's MongoDB connector).
 */
export async function getCrisisWorkspace(crisisEventId: string) {
  // Fetch the base crisis first — we need it to exist before fan-out.
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: {
      id: true,
      title: true,
      status: true,
      severityLevel: true,
      incidentType: true,
      locationText: true,
      latitude: true,
      longitude: true,
      version: true,
      reportCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  // Fan out all relation queries in parallel — each is a single MongoDB
  // round-trip, so total latency ≈ max(queries) instead of sum(queries).
  const [claims, needs, assignments, responders, updates, evidencePosts, ocrScans] =
    await Promise.all([
      prisma.claim.findMany({
        where: { crisisEventId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          claimType: true,
          subject: true,
          value: true,
          evidenceState: true,
          conflictCount: true,
          supportCount: true,
          needsHumanDecision: true,
        },
      }),
      prisma.need.findMany({
        where: { crisisEventId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          needType: true,
          description: true,
          quantity: true,
          unit: true,
          urgency: true,
          isMet: true,
        },
      }),
      prisma.assignment.findMany({
        where: { crisisEventId },
        include: {
          volunteer: { select: { id: true, fullName: true, skills: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.crisisResponder.findMany({
        where: { crisisEventId },
        include: {
          volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
        },
        orderBy: { optedInAt: "desc" },
      }),
      prisma.crisisEventUpdate.findMany({
        where: { crisisEventId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          updateType: true,
          updateNote: true,
          newStatus: true,
          verificationStatus: true,
          createdAt: true,
        },
      }),
      prisma.evidencePost.findMany({
        where: { crisisEventId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      prisma.oCRScan.findMany({
        where: { crisisEventId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rawText: true,
          sourceImageUrl: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    crisis,
    claims,
    needs,
    assignments: assignments.map((a) => ({
      id: a.id,
      status: a.status,
      volunteer: a.volunteer,
    })),
    responders: responders.map((r) => ({
      id: r.id,
      status: r.status,
      volunteer: r.volunteer,
      optedInAt: r.optedInAt,
      lastStatusAt: r.lastStatusAt,
    })),
    updates,
    evidencePosts: evidencePosts.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      mediaUrls: e.mediaUrls,
      mediaType: e.mediaType,
      isVerified: e.isVerified,
      visibility: e.visibility,
      uploaderName: e.user.fullName,
      uploaderAvatar: e.user.avatarUrl,
      createdAt: e.createdAt,
    })),
    ocrScans,
  };
}
