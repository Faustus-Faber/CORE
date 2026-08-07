import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";

/**
 * FR-05: Get the unified crisis operations workspace data.
 * Returns crisis, claims, needs, assignments, and updates in one response.
 */
export async function getCrisisWorkspace(crisisEventId: string) {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    include: {
      reports: { include: { incidentReport: true } },
      updates: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      claims: {
        orderBy: { createdAt: "desc" },
      },
      needs: {
        orderBy: { createdAt: "desc" },
      },
      assignments: {
        include: {
          volunteer: { select: { id: true, fullName: true, skills: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      responders: {
        include: {
          volunteer: { select: { id: true, fullName: true, avatarUrl: true, skills: true, location: true } },
        },
        orderBy: { optedInAt: "desc" },
      },
      evidencePosts: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      },
      ocrScans: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rawText: true,
          sourceImageUrl: true,
          createdAt: true,
        },
      },
    },
  });

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  return {
    crisis: {
      id: crisis.id,
      title: crisis.title,
      status: crisis.status,
      severityLevel: crisis.severityLevel,
      locationText: crisis.locationText,
      latitude: crisis.latitude,
      longitude: crisis.longitude,
      version: crisis.version,
      reportCount: crisis.reportCount,
      createdAt: crisis.createdAt,
      updatedAt: crisis.updatedAt,
    },
    claims: crisis.claims.map((c) => ({
      id: c.id,
      claimType: c.claimType,
      subject: c.subject,
      value: c.value,
      evidenceState: c.evidenceState,
      conflictCount: c.conflictCount,
      supportCount: c.supportCount,
      needsHumanDecision: c.needsHumanDecision,
    })),
    needs: crisis.needs.map((n) => ({
      id: n.id,
      needType: n.needType,
      description: n.description,
      quantity: n.quantity,
      unit: n.unit,
      urgency: n.urgency,
      isMet: n.isMet,
    })),
    assignments: crisis.assignments.map((a) => ({
      id: a.id,
      status: a.status,
      volunteer: a.volunteer,
    })),
    responders: crisis.responders.map((r) => ({
      id: r.id,
      status: r.status,
      volunteer: r.volunteer,
      optedInAt: r.optedInAt,
      lastStatusAt: r.lastStatusAt,
    })),
    updates: crisis.updates.map((u) => ({
      id: u.id,
      updateType: u.updateType,
      updateNote: u.updateNote,
      newStatus: u.newStatus,
      verificationStatus: u.verificationStatus,
      createdAt: u.createdAt,
    })),
    evidencePosts: crisis.evidencePosts.map((e) => ({
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
    ocrScans: crisis.ocrScans.map((o) => ({
      id: o.id,
      rawText: o.rawText,
      sourceImageUrl: o.sourceImageUrl,
      createdAt: o.createdAt,
    })),
  };
}
