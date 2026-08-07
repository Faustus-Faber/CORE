import { prisma } from "../lib/prisma.js";

/**
 * FR-04: Get candidate crisis events for a report during triage.
 * Uses deterministic filtering by incident type, geographic distance, and time window.
 */
export async function getTriageCandidates(reportId: string) {
  const report = await prisma.incidentReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  // Get all active crisis events with matching incident type
  const candidates = await prisma.crisisEvent.findMany({
    where: {
      incidentType: report.incidentType,
      status: { notIn: ["CLOSED", "RESOLVED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  // Score candidates by geographic distance and time proximity
  const scored = candidates.map((event) => {
    let similarityScore = 0;

    // Geographic distance scoring
    if (report.latitude != null && report.longitude != null &&
        event.latitude != null && event.longitude != null) {
      const distanceKm = haversineDistance(
        report.latitude, report.longitude,
        event.latitude, event.longitude
      );
      // Closer events score higher
      if (distanceKm < 1) similarityScore += 50;
      else if (distanceKm < 5) similarityScore += 30;
      else if (distanceKm < 20) similarityScore += 15;
      else if (distanceKm < 50) similarityScore += 5;
    }

    // Time proximity scoring
    const timeDiffHours = Math.abs(
      (new Date().getTime() - event.createdAt.getTime()) / (1000 * 60 * 60)
    );
    if (timeDiffHours < 6) similarityScore += 20;
    else if (timeDiffHours < 24) similarityScore += 10;
    else if (timeDiffHours < 72) similarityScore += 5;

    return {
      id: event.id,
      title: event.title,
      status: event.status,
      severityLevel: event.severityLevel,
      locationText: event.locationText,
      reportCount: event.reportCount,
      similarityScore,
    };
  });

  // Sort by similarity score descending
  scored.sort((a, b) => b.similarityScore - a.similarityScore);

  return { candidates: scored.slice(0, 10) };
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
