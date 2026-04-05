import type {
  CrisisEvent,
  CrisisEventStatus,
  IncidentReport,
  IncidentSeverity,
  IncidentType,
  Prisma
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { classifyIncidentText } from "./textAnalysisClient.js";

const severityRanking: Record<IncidentSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const allActiveStatuses: CrisisEventStatus[] = ["ACTIVE", "CONTAINED"];

const objectIdHexPattern = /^[a-fA-F0-9]{24}$/;

export type DashboardFeedFilter = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  incidentType?: IncidentType | "ALL";
  severity?: IncidentSeverity | "ALL";
  timeRangeHours?: number;
  sortBy?: "mostRecent" | "highestSeverity" | "mostReports";
  sortOrder?: "asc" | "desc";
};

export type CrisisEventCard = {
  id: string;
  title: string;
  classifiedIncidentTitle: string;
  incidentType: IncidentType;
  severityLevel: IncidentSeverity;
  status: CrisisEventStatus;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  reportCount: number;
  reporterCount: number;
  credibilityScore: number;
  createdAt: string;
  mediaFilenames: string[];
  descriptionExcerpt: string;
};

export type SitRepBlueprint = {
  version: string;
  generatedAt: string;
  threatLevel: "GREEN" | "AMBER" | "RED" | "CRITICAL";
  metrics: Array<{ label: string; value: number; trend?: string; color: string }>;
  pulseMap: Array<{ lat: number; lng: number; intensity: string; label: string }>;
  timeline: Array<{ time: string; event: string; severity: string }>;
  warnings: Array<{ zone: string; reason: string; until: string }>;
  resources: Array<{ name: string; qty: string; location: string; eta: string }>;
  advisories: string[];
};

export type SitRepResponse = {
  blueprint: SitRepBlueprint;
};

export type IncidentDetailResponse = {
  crisisEvent: CrisisEvent;
  contributingReports: IncidentReportListItem[];
  nearbyResources: ResourceSummary[];
};

type ReporterRecord = {
  id: string;
  fullName: string;
};

type IncidentReportListItem = {
  id: string;
  reporterId: string;
  reporterName: string;
  incidentTitle: string;
  classifiedIncidentTitle: string;
  incidentType: IncidentType;
  classifiedIncidentType: IncidentType;
  description: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  mediaFilenames: string[];
  credibilityScore: number;
  severityLevel: IncidentSeverity;
  status: string;
  spamFlagged: boolean;
  createdAt: string;
};

type ResourceSummary = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  address: string;
  distanceKm?: number;
};

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function listUsers(userIds: string[]): Promise<ReporterRecord[]> {
  const validUserIds = userIds.filter((id) => objectIdHexPattern.test(id));
  if (validUserIds.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: { id: { in: validUserIds } },
    select: { id: true, fullName: true }
  });
}

export async function getDashboardFeed(
  filters: DashboardFeedFilter
): Promise<CrisisEventCard[]> {
  const where: Prisma.CrisisEventWhereInput = {};

  if (filters.severity && filters.severity !== "ALL") {
    where.severityLevel = filters.severity;
  }

  if (filters.incidentType && filters.incidentType !== "ALL") {
    where.incidentType = filters.incidentType;
  }

  if (filters.timeRangeHours && filters.timeRangeHours > 0) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - filters.timeRangeHours);
    where.createdAt = { gte: cutoff };
  }

  if (filters.lat && filters.lng && filters.radiusKm) {
    const radius = filters.radiusKm;
    const latFilter: number = filters.lat;
    const lngFilter: number = filters.lng;
    const degreeRadius = radius / 111;

    where.latitude = {
      gte: latFilter - degreeRadius * 1.5,
      lte: latFilter + degreeRadius * 1.5
    };
    where.longitude = {
      gte: lngFilter - degreeRadius,
      lte: lngFilter + degreeRadius
    };
  }

  const events = await prisma.crisisEvent.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  let results = events;

  if (filters.lat && filters.lng && filters.radiusKm) {
    results = results.filter((event) => {
      if (event.latitude == null || event.longitude == null) {
        return true;
      }
      const distance = haversineDistance(
        filters.lat!,
        filters.lng!,
        event.latitude,
        event.longitude
      );
      return distance <= filters.radiusKm!;
    });
  }

  const sortBy = filters.sortBy ?? "mostRecent";
  const sortOrder = filters.sortOrder ?? "desc";

  results.sort((a, b) => {
    let comparison = 0;

    if (sortBy === "highestSeverity") {
      comparison =
        severityRanking[a.severityLevel] - severityRanking[b.severityLevel];
    } else if (sortBy === "mostReports") {
      comparison = a.reportCount - b.reportCount;
    } else {
      comparison =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }

    return sortOrder === "asc" ? comparison : comparison * -1;
  });

  const eventIds = results.map((e) => e.id);

  const reportsByEvent = await prisma.crisisEventReport.findMany({
    where: { crisisEventId: { in: eventIds } },
    include: {
      incidentReport: {
        select: {
          id: true,
          reporterId: true,
          description: true,
          mediaFilenames: true,
          credibilityScore: true,
          classifiedIncidentTitle: true,
          createdAt: true
        }
      }
    }
  });

  const reportsMap = new Map<string, typeof reportsByEvent>();
  for (const report of reportsByEvent) {
    const key = report.crisisEventId;
    if (!reportsMap.has(key)) {
      reportsMap.set(key, []);
    }
    reportsMap.get(key)!.push(report);
  }

  const allReporterIds = Array.from(
    new Set(
      reportsByEvent.map((r) => r.incidentReport.reporterId).filter(Boolean)
    )
  );
  const reporters = await listUsers(allReporterIds);
  const reporterMap = new Map(
    reporters.map((r) => [r.id, r.fullName])
  );

  return results.map((event) => {
    const eventReports = reportsMap.get(event.id) ?? [];
    const firstReport = eventReports[0]?.incidentReport;
    const descriptionExcerpt = firstReport?.description
      ? firstReport.description.slice(0, 150) +
        (firstReport.description.length > 150 ? "..." : "")
      : "No description available";

    const mediaFilenames = eventReports.flatMap(
      (r) => r.incidentReport.mediaFilenames
    );

    const avgCredibility =
      eventReports.length > 0
        ? Math.round(
            eventReports.reduce(
              (sum, r) => sum + r.incidentReport.credibilityScore,
              0
            ) / eventReports.length
          )
        : 0;

    return {
      id: event.id,
      title: event.title,
      classifiedIncidentTitle:
        firstReport?.classifiedIncidentTitle ?? event.title,
      incidentType: event.incidentType,
      severityLevel: event.severityLevel,
      status: event.status,
      locationText: event.locationText,
      latitude: event.latitude,
      longitude: event.longitude,
      reportCount: event.reportCount,
      reporterCount: event.reporterCount,
      credibilityScore: avgCredibility,
      createdAt: event.createdAt.toISOString(),
      mediaFilenames: mediaFilenames.slice(0, 1),
      descriptionExcerpt
    };
  });
}

export async function clusterReportIntoCrisisEvent(
  report: {
    id: string;
    incidentTitle: string;
    description: string;
    locationText: string;
    incidentType: IncidentType;
    severityLevel: IncidentSeverity;
    latitude: number | null;
    longitude: number | null;
    reporterId: string;
  }
): Promise<{ crisisEventId: string; isNew: boolean }> {
  const activeEvents = await prisma.crisisEvent.findMany({
    where: { status: { in: allActiveStatuses } },
    orderBy: { createdAt: "desc" }
  });

  if (activeEvents.length === 0) {
    const newEvent = await prisma.crisisEvent.create({
      data: {
        title: report.incidentTitle,
        incidentType: report.incidentType,
        severityLevel: report.severityLevel,
        locationText: report.locationText,
        latitude: report.latitude,
        longitude: report.longitude,
        status: "ACTIVE",
        reportCount: 1,
        reporterCount: 1
      }
    });

    await prisma.crisisEventReport.create({
      data: {
        crisisEventId: newEvent.id,
        incidentReportId: report.id
      }
    });

    return { crisisEventId: newEvent.id, isNew: true };
  }

  const candidateText = `${report.incidentTitle} ${report.description} ${report.locationText}`;

  let bestMatch: { eventId: string; score: number } | null = null;

  for (const event of activeEvents) {
    const eventReports = await prisma.crisisEventReport.findMany({
      where: { crisisEventId: event.id },
      include: {
        incidentReport: {
          select: {
            incidentTitle: true,
            description: true,
            locationText: true
          }
        }
      }
    });

    const eventText = eventReports
      .map(
        (r) =>
          `${r.incidentReport.incidentTitle} ${r.incidentReport.description} ${r.incidentReport.locationText}`
      )
      .join(" ");

    if (!eventText.trim()) {
      const typeMatch = event.incidentType === report.incidentType;
      const locSimilar = locationSimilarity(
        report.locationText,
        event.locationText,
        report.latitude,
        report.longitude,
        event.latitude,
        event.longitude
      );
      const score = typeMatch ? 0.5 + locSimilar * 0.5 : locSimilar * 0.3;

      if (score > (bestMatch?.score ?? 0)) {
        bestMatch = { eventId: event.id, score };
      }
      continue;
    }

    const similarity = await computeSimilarity(candidateText, eventText);

    if (similarity > (bestMatch?.score ?? 0)) {
      bestMatch = { eventId: event.id, score: similarity };
    }
  }

  const SIMILARITY_THRESHOLD = 0.8;

  if (bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD) {
    await prisma.crisisEventReport.create({
      data: {
        crisisEventId: bestMatch.eventId,
        incidentReportId: report.id
      }
    });

    const existingLink = await prisma.crisisEventReport.findFirst({
      where: { incidentReportId: report.id }
    });

    if (!existingLink) {
      await prisma.crisisEvent.update({
        where: { id: bestMatch.eventId },
        data: {
          reportCount: { increment: 1 },
          reporterCount: { increment: 1 }
        }
      });
    }

    return { crisisEventId: bestMatch.eventId, isNew: false };
  }

  const newEvent = await prisma.crisisEvent.create({
    data: {
      title: report.incidentTitle,
      incidentType: report.incidentType,
      severityLevel: report.severityLevel,
      locationText: report.locationText,
      latitude: report.latitude,
      longitude: report.longitude,
      status: "ACTIVE",
      reportCount: 1,
      reporterCount: 1
    }
  });

  await prisma.crisisEventReport.create({
    data: {
      crisisEventId: newEvent.id,
      incidentReportId: report.id
    }
  });

  return { crisisEventId: newEvent.id, isNew: true };
}

function locationSimilarity(
  locA: string,
  locB: string,
  latA: number | null,
  lngA: number | null,
  latB: number | null,
  lngB: number | null
): number {
  const normA = locA.toLowerCase().trim();
  const normB = locB.toLowerCase().trim();

  if (normA === normB) {
    return 1.0;
  }

  const wordsA = new Set(normA.split(/\s+/));
  const wordsB = new Set(normB.split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  if (latA != null && lngA != null && latB != null && lngB != null) {
    const distance = haversineDistance(latA, lngA, latB, lngB);
    if (distance < 2) {
      return Math.max(jaccard, 0.85);
    }
    if (distance < 5) {
      return Math.max(jaccard, 0.7);
    }
    if (distance < 10) {
      return Math.max(jaccard, 0.5);
    }
  }

  return jaccard;
}

async function computeSimilarity(
  textA: string,
  textB: string
): Promise<number> {
  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, env.aiRequestTimeoutMs);

    const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqQwenModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a similarity scoring engine. Compare two emergency incident reports. Return ONLY a JSON object with key 'similarity_score' as a number between 0 and 1. Score 1.0 means they describe the exact same incident. Score 0 means completely unrelated. Do not include markdown."
          },
          {
            role: "user",
            content: `Report A: ${textA}\n\nReport B: ${textB}\n\nReturn JSON: {"similarity_score": <number>}`
          }
        ]
      }),
      signal: abortController.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackSimilarity(textA, textB);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(content);
      return Math.min(1, Math.max(0, parsed.similarity_score ?? 0));
    } catch {
      return fallbackSimilarity(textA, textB);
    }
  } catch {
    return fallbackSimilarity(textA, textB);
  }
}

function fallbackSimilarity(
  textA: string,
  textB: string
): number {
  const wordsA = new Set(
    textA
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const wordsB = new Set(
    textB
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

export async function generateSitRep(
  lat?: number,
  lng?: number,
  radiusKm?: number
): Promise<SitRepResponse> {
  const where: Prisma.CrisisEventWhereInput = {
    status: { in: allActiveStatuses }
  };

  let events = await prisma.crisisEvent.findMany({
    where,
    orderBy: [{ severityLevel: "desc" }, { createdAt: "desc" }]
  });

  if (lat && lng && radiusKm) {
    const degreeRadius = radiusKm / 111;
    const filtered = events.filter((event) => {
      if (event.latitude == null || event.longitude == null) {
        return true;
      }
      const distance = haversineDistance(
        lat,
        lng,
        event.latitude,
        event.longitude
      );
      return distance <= radiusKm;
    });
    events = filtered;
  }

  const resources = await prisma.resource.findMany({
    where: { status: { in: ["Available", "Low Stock"] } },
    select: {
      id: true,
      name: true,
      category: true,
      quantity: true,
      unit: true,
      status: true,
      address: true,
      latitude: true,
      longitude: true
    }
  });

  let nearbyResources: ResourceSummary[] = resources;

  if (lat && lng) {
    nearbyResources = resources
      .map((r) => {
        const distance =
          r.latitude != null && r.longitude != null
            ? haversineDistance(lat, lng, r.latitude, r.longitude)
            : undefined;
        return { ...r, distanceKm: distance };
      })
      .filter((r) => r.distanceKm == null || r.distanceKm <= (radiusKm ?? 10))
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .slice(0, 5);
  }

  const incidentSummaries = events.map(
    (e) =>
      `- ${e.title} (${e.severityLevel}, ${e.incidentType}) at ${e.locationText}. ${e.sitRepText ?? "No update available."}`
  );

  const resourceSummaries = nearbyResources.map(
    (r) =>
      `- ${r.name}: ${r.quantity} ${r.unit} (${r.status}) at ${r.address}${r.distanceKm != null ? ` (${r.distanceKm.toFixed(1)} km away)` : ""}`
  );

  const criticalEvents = events.filter((e) => e.severityLevel === "CRITICAL");
  const highEvents = events.filter((e) => e.severityLevel === "HIGH");
  const mediumEvents = events.filter((e) => e.severityLevel === "MEDIUM");
  const lowEvents = events.filter((e) => e.severityLevel === "LOW");

  const threatLevel = criticalEvents.length > 0 ? "CRITICAL" : highEvents.length > 0 ? "RED" : mediumEvents.length > 0 ? "AMBER" : "GREEN";

  const timelineData = events
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map((e) => ({
      time: timeAgo(e.createdAt),
      event: e.title,
      severity: e.severityLevel
    }));

  const warningsData = events
    .filter((e) => e.severityLevel === "CRITICAL" || e.severityLevel === "HIGH")
    .map((e) => ({
      zone: e.locationText,
      reason: `${e.severityLevel} ${e.incidentType}`,
      until: e.status === "ACTIVE" ? "Until further notice" : "Monitoring in progress"
    }));

  const resourcesData = nearbyResources.map((r) => ({
    name: r.name,
    qty: `${r.quantity} ${r.unit}`,
    location: r.address.split(",")[0] ?? r.address,
    eta: r.status === "Available" ? "Now" : "Limited"
  }));

  const pulseMapData = events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({
      lat: e.latitude!,
      lng: e.longitude!,
      intensity: e.severityLevel.toLowerCase(),
      label: e.title
    }));

  const metricsData = [
    { label: "Active Incidents", value: events.length, color: "critical", trend: criticalEvents.length > 0 ? `+${criticalEvents.length} critical` : undefined },
    { label: "Reports Merged", value: events.reduce((s, e) => s + e.reportCount, 0), color: "neutral" },
    { label: "Responders", value: new Set(events.map((e) => e.reporterCount)).size > 0 ? events.reduce((s, e) => s + e.reporterCount, 0) : 0, color: "medium" },
    { label: "Resources Available", value: nearbyResources.length, color: "low" }
  ];

  const advisoriesDefault = [
    "Avoid all affected areas unless actively responding to the emergency",
    "Monitor official channels for real-time updates",
    "Check on vulnerable neighbors and elderly residents",
    "Keep emergency contact numbers accessible"
  ];

  const blueprint: SitRepBlueprint = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    threatLevel,
    metrics: metricsData,
    pulseMap: pulseMapData,
    timeline: timelineData,
    warnings: warningsData,
    resources: resourcesData,
    advisories: advisoriesDefault
  };

  try {
    const aiAdvisories = await generateAiAdvisories(events, nearbyResources);
    if (aiAdvisories.length > 0) {
      blueprint.advisories = aiAdvisories;
    }
  } catch {
    // Use default advisories if AI fails
  }

  return { blueprint };
}

async function generateAiAdvisories(
  events: CrisisEvent[],
  resources: ResourceSummary[]
): Promise<string[]> {
  const incidentContext = events.map(
    (e) => `${e.title} (${e.severityLevel}) at ${e.locationText} - ${e.sitRepText ?? "Active"}`
  ).join("; ");

  const resourceContext = resources.map(
    (r) => `${r.name}: ${r.quantity} ${r.unit} at ${r.address}`
  ).join("; ");

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), env.aiRequestTimeoutMs);

    const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqQwenModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You generate safety advisories for a crisis dashboard. Return ONLY a JSON object with key 'advisories' containing an array of 5-7 short advisory strings. No markdown. No explanations."
          },
          {
            role: "user",
            content: `Active incidents: ${incidentContext}. Available resources: ${resourceContext}. Generate 5-7 concise safety advisories for the community.`
          }
        ]
      }),
      signal: abortController.signal
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed.advisories) ? parsed.advisories.slice(0, 7) : [];
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export async function getIncidentDetail(
  incidentId: string
): Promise<IncidentDetailResponse | null> {
  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: incidentId }
  });

  if (!crisisEvent) {
    return null;
  }

  const eventReportLinks = await prisma.crisisEventReport.findMany({
    where: { crisisEventId: incidentId },
    include: {
      incidentReport: true
    },
    orderBy: { createdAt: "asc" }
  });

  const reports = eventReportLinks.map((link) => link.incidentReport);

  const reporterIds = Array.from(
    new Set(reports.map((r) => r.reporterId).filter(Boolean))
  );
  const reporters = await listUsers(reporterIds);
  const reporterMap = new Map(
    reporters.map((r) => [r.id, r.fullName])
  );

  const contributingReports: IncidentReportListItem[] = reports.map(
    (report) => ({
      id: report.id,
      reporterId: report.reporterId,
      reporterName:
        reporterMap.get(report.reporterId) ?? "Community Member",
      incidentTitle: report.incidentTitle,
      classifiedIncidentTitle: report.classifiedIncidentTitle,
      incidentType: report.incidentType,
      classifiedIncidentType: report.classifiedIncidentType,
      description: report.description,
      locationText: report.locationText,
      latitude: report.latitude,
      longitude: report.longitude,
      mediaFilenames: report.mediaFilenames,
      credibilityScore: report.credibilityScore,
      severityLevel: report.severityLevel,
      status: report.status,
      spamFlagged: report.spamFlagged,
      createdAt: report.createdAt.toISOString()
    })
  );

  let nearbyResources: ResourceSummary[] = [];

  if (crisisEvent.latitude != null && crisisEvent.longitude != null) {
    const allResources = await prisma.resource.findMany({
      where: { status: { in: ["Available", "Low Stock"] } }
    });

    nearbyResources = allResources
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        quantity: r.quantity,
        unit: r.unit,
        status: r.status,
        address: r.address,
        distanceKm:
          r.latitude != null && r.longitude != null
            ? haversineDistance(
                crisisEvent.latitude!,
                crisisEvent.longitude!,
                r.latitude,
                r.longitude
              )
            : undefined
      }))
      .filter((r) => r.distanceKm == null || r.distanceKm <= 10)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .slice(0, 5);
  }

  return {
    crisisEvent,
    contributingReports,
    nearbyResources
  };
}