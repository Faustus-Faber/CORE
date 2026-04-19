import type {
  CrisisEvent,
  CrisisEventStatus,
  IncidentSeverity,
  IncidentType,
  Prisma
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { severityRanking } from "../utils/incidentMapping.js";
import { fetchReporters, buildReporterMap } from "../utils/reporterLookup.js";
import { stripThinkingTagsFromJson } from "../utils/sanitize.js";

const ACTIVE_STATUSES: CrisisEventStatus[] = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED"
];
const SIMILARITY_THRESHOLD = 0.8;
const NEARBY_RESOURCE_LIMIT = 5;
const DEFAULT_NEARBY_RADIUS_KM = 10;
const TIMELINE_LIMIT = 8;
const EXCERPT_LENGTH = 150;

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

export type IncidentDetailResponse = {
  crisisEvent: CrisisEvent;
  contributingReports: IncidentReportListItem[];
  nearbyResources: ResourceSummary[];
};

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function truncateExcerpt(text: string): string {
  if (text.length <= EXCERPT_LENGTH) return text;
  return text.slice(0, EXCERPT_LENGTH) + "...";
}

function filterByRadius<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  lat: number,
  lng: number,
  radiusKm: number
): T[] {
  return items.filter((item) => {
    if (item.latitude == null || item.longitude == null) return true;
    return haversineDistanceKm(lat, lng, item.latitude, item.longitude) <= radiusKm;
  });
}

function sortEvents(
  events: CrisisEvent[],
  sortBy: string,
  sortOrder: "asc" | "desc"
): CrisisEvent[] {
  return [...events].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "highestSeverity") {
      comparison = severityRanking[a.severityLevel] - severityRanking[b.severityLevel];
    } else if (sortBy === "mostReports") {
      comparison = a.reportCount - b.reportCount;
    } else {
      comparison = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });
}

function buildFeedWhere(filters: DashboardFeedFilter): Prisma.CrisisEventWhereInput {
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
    const degreeRadius = filters.radiusKm / 111;
    where.latitude = {
      gte: filters.lat - degreeRadius * 1.5,
      lte: filters.lat + degreeRadius * 1.5
    };
    where.longitude = {
      gte: filters.lng - degreeRadius,
      lte: filters.lng + degreeRadius
    };
  }

  return where;
}

export async function getDashboardFeed(
  filters: DashboardFeedFilter
): Promise<CrisisEventCard[]> {
  const events = await prisma.crisisEvent.findMany({
    where: buildFeedWhere(filters),
    orderBy: { createdAt: "desc" }
  });

  const filtered = filters.lat && filters.lng && filters.radiusKm
    ? filterByRadius(events, filters.lat, filters.lng, filters.radiusKm)
    : events;

  const sorted = sortEvents(filtered, filters.sortBy ?? "mostRecent", filters.sortOrder ?? "desc");

  const eventIds = sorted.map((e) => e.id);
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
    const existing = reportsMap.get(report.crisisEventId);
    if (existing) {
      existing.push(report);
    } else {
      reportsMap.set(report.crisisEventId, [report]);
    }
  }

  return sorted.map((event) => {
    const eventReports = reportsMap.get(event.id) ?? [];
    const firstReport = eventReports[0]?.incidentReport;

    const avgCredibility = eventReports.length > 0
      ? Math.round(eventReports.reduce((sum, r) => sum + r.incidentReport.credibilityScore, 0) / eventReports.length)
      : 0;

    return {
      id: event.id,
      title: event.title,
      classifiedIncidentTitle: firstReport?.classifiedIncidentTitle ?? event.title,
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
      mediaFilenames: eventReports.flatMap((r) => r.incidentReport.mediaFilenames).slice(0, 1),
      descriptionExcerpt: firstReport?.description
        ? truncateExcerpt(firstReport.description)
        : "No description available"
    };
  });
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

  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(/\s+/));
  const wordsB = new Set(normB.split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  if (latA != null && lngA != null && latB != null && lngB != null) {
    const distance = haversineDistanceKm(latA, lngA, latB, lngB);
    if (distance < 2) return Math.max(jaccard, 0.85);
    if (distance < 5) return Math.max(jaccard, 0.7);
    if (distance < 10) return Math.max(jaccard, 0.5);
  }

  return jaccard;
}

function fallbackSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

const similaritySystemPrompt = [
  "You are a duplicate-incident detection engine for a crisis response platform.",
  "",
  "You will receive two emergency incident reports (Report A and Report B). Determine whether they describe the SAME real-world incident.",
  "",
  'Return ONLY a JSON object: {"similarity_score": <number>}',
  "",
  "Scoring rules:",
  "  1.0  — certainly the same incident (same event, same location, same timeframe).",
  "  0.8-0.99 — very likely the same incident described differently.",
  "  0.5-0.79 — possibly related (same area and type, but could be separate events).",
  "  0.2-0.49 — weakly related (same general type but clearly different events).",
  "  0.0-0.19 — completely unrelated incidents.",
  "",
  "Key factors to consider:",
  "  - Geographic proximity: incidents at the same location or within 1-2km are more likely duplicates.",
  "  - Incident type match: a flood report and another flood report in the same area are likely duplicates.",
  "  - Temporal cues: references to the same time/date increase similarity.",
  "  - Distinct details: different casualty counts, different buildings, or different streets lower similarity.",
  "",
  "Return raw JSON only. No markdown, no explanation."
].join("\n");

async function computeSimilarity(textA: string, textB: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiRequestTimeoutMs);

    const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqQwenModel,
        temperature: 0,
        max_tokens: 200,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: similaritySystemPrompt },
          {
            role: "user",
            content: `Report A: ${textA}\n\nReport B: ${textB}\n\nReturn JSON: {"similarity_score": <number>}`
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) return fallbackSimilarity(textA, textB);

    const payload = await response.json();
    const content = stripThinkingTagsFromJson(payload.choices?.[0]?.message?.content ?? "");

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

async function createNewCrisisEvent(report: {
  id: string;
  incidentTitle: string;
  incidentType: IncidentType;
  severityLevel: IncidentSeverity;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<{ crisisEventId: string; isNew: true }> {
  const newEvent = await prisma.crisisEvent.create({
    data: {
      title: report.incidentTitle,
      incidentType: report.incidentType,
      severityLevel: report.severityLevel,
      locationText: report.locationText,
      latitude: report.latitude,
      longitude: report.longitude,
      status: "REPORTED",
      reportCount: 1,
      reporterCount: 1
    }
  });

  await prisma.crisisEventReport.create({
    data: { crisisEventId: newEvent.id, incidentReportId: report.id }
  });

  return { crisisEventId: newEvent.id, isNew: true };
}

async function linkReportToEvent(
  eventId: string,
  reportId: string,
  reporterId: string
): Promise<{ crisisEventId: string; isNew: false }> {
  const existingLink = await prisma.crisisEventReport.findFirst({
    where: { incidentReportId: reportId }
  });

  if (existingLink) {
    return { crisisEventId: existingLink.crisisEventId, isNew: false };
  }

  const existingReporterLink = await prisma.crisisEventReport.findFirst({
    where: {
      crisisEventId: eventId,
      incidentReport: { reporterId }
    }
  });

  await prisma.$transaction([
    prisma.crisisEventReport.create({
      data: { crisisEventId: eventId, incidentReportId: reportId }
    }),
    prisma.crisisEvent.update({
      where: { id: eventId },
      data: {
        reportCount: { increment: 1 },
        reporterCount: existingReporterLink ? undefined : { increment: 1 }
      }
    })
  ]);

  return { crisisEventId: eventId, isNew: false };
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
    spamFlagged: boolean;
  }
): Promise<{ crisisEventId: string; isNew: boolean }> {
  if (report.spamFlagged) {
    return { crisisEventId: "spam-skipped", isNew: false };
  }

  const activeEvents = await prisma.crisisEvent.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" }
  });

  if (activeEvents.length === 0) {
    return createNewCrisisEvent(report);
  }

  const candidateText = `${report.incidentTitle} ${report.description} ${report.locationText}`;
  let bestMatch: { eventId: string; score: number } | null = null;

  for (const event of activeEvents) {
    const eventReports = await prisma.crisisEventReport.findMany({
      where: { crisisEventId: event.id },
      include: {
        incidentReport: {
          select: { incidentTitle: true, description: true, locationText: true }
        }
      }
    });

    const eventText = eventReports
      .map((r) => `${r.incidentReport.incidentTitle} ${r.incidentReport.description} ${r.incidentReport.locationText}`)
      .join(" ");

    let score: number;

    if (!eventText.trim()) {
      const typeMatch = event.incidentType === report.incidentType;
      const locScore = locationSimilarity(
        report.locationText, event.locationText,
        report.latitude, report.longitude,
        event.latitude, event.longitude
      );
      score = typeMatch ? 0.5 + locScore * 0.5 : locScore * 0.3;
    } else {
      score = await computeSimilarity(candidateText, eventText);
    }

    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = { eventId: event.id, score };
    }
  }

  if (bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD) {
    return linkReportToEvent(bestMatch.eventId, report.id, report.reporterId);
  }

  return createNewCrisisEvent(report);
}

function computeThreatLevel(events: CrisisEvent[]): SitRepBlueprint["threatLevel"] {
  if (events.some((e) => e.severityLevel === "CRITICAL")) return "CRITICAL";
  if (events.some((e) => e.severityLevel === "HIGH")) return "RED";
  if (events.some((e) => e.severityLevel === "MEDIUM")) return "AMBER";
  return "GREEN";
}

function buildTimelineData(events: CrisisEvent[]) {
  return [...events]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, TIMELINE_LIMIT)
    .map((e) => ({
      time: timeAgo(e.createdAt),
      event: e.title,
      severity: e.severityLevel
    }));
}

function buildWarningsData(events: CrisisEvent[]) {
  return events
    .filter((e) => e.severityLevel === "CRITICAL" || e.severityLevel === "HIGH")
    .map((e) => ({
      zone: e.locationText,
      reason: `${e.severityLevel} ${e.incidentType}`,
      until: e.status === "REPORTED" ? "Until further notice" : "Monitoring in progress"
    }));
}

function buildResourcesData(resources: ResourceSummary[]) {
  return resources.map((r) => ({
    name: r.name,
    qty: `${r.quantity} ${r.unit}`,
    location: r.address.split(",")[0] ?? r.address,
    eta: r.status === "Available" ? "Now" : "Limited"
  }));
}

function buildPulseMapData(events: CrisisEvent[]) {
  return events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({
      lat: e.latitude!,
      lng: e.longitude!,
      intensity: e.severityLevel.toLowerCase(),
      label: e.title
    }));
}

function buildMetricsData(events: CrisisEvent[], resourceCount: number) {
  const criticalCount = events.filter((e) => e.severityLevel === "CRITICAL").length;
  return [
    {
      label: "Active Incidents",
      value: events.length,
      color: "critical",
      trend: criticalCount > 0 ? `+${criticalCount} critical` : undefined
    },
    {
      label: "Reports Merged",
      value: events.reduce((sum, e) => sum + e.reportCount, 0),
      color: "neutral"
    },
    {
      label: "Responders",
      value: events.reduce((sum, e) => sum + e.reporterCount, 0),
      color: "medium"
    },
    {
      label: "Resources Available",
      value: resourceCount,
      color: "low"
    }
  ];
}

function attachDistances(
  resources: Array<{ id: string; name: string; category: string; quantity: number; unit: string; status: string; address: string; latitude: number | null; longitude: number | null }>,
  lat: number,
  lng: number,
  radiusKm: number
): ResourceSummary[] {
  return resources
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      status: r.status,
      address: r.address,
      distanceKm: r.latitude != null && r.longitude != null
        ? haversineDistanceKm(lat, lng, r.latitude, r.longitude)
        : undefined
    }))
    .filter((r) => r.distanceKm == null || r.distanceKm <= radiusKm)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, NEARBY_RESOURCE_LIMIT);
}

const DEFAULT_ADVISORIES = [
  "Avoid all affected areas unless actively responding to the emergency",
  "Monitor official channels for real-time updates",
  "Check on vulnerable neighbors and elderly residents",
  "Keep emergency contact numbers accessible"
];

const advisorySystemPrompt = [
  "You are a public safety advisor for a community crisis dashboard in Bangladesh.",
  "",
  "Based on the active incidents and available resources provided, generate actionable safety advisories for community members.",
  "",
  'Return ONLY a JSON object: {"advisories": ["...", "...", ...]}',
  "",
  "Rules:",
  "  - Generate exactly 5 to 7 advisory strings.",
  "  - Each advisory must be 1 sentence, under 25 words, and directly actionable.",
  "  - Tailor advisories to the specific incident types present (e.g., flood → move to higher ground; fire → avoid smoke inhalation).",
  "  - If resources are available, mention them (e.g., 'Medical supplies available at Mirpur-10 relief center').",
  "  - Include at least one general safety advisory (e.g., 'Keep emergency contacts accessible').",
  "  - Do not repeat the same advice in different words.",
  "",
  "Return raw JSON only. No markdown, no explanation."
].join("\n");

async function generateAiAdvisories(
  events: CrisisEvent[],
  resources: ResourceSummary[]
): Promise<string[]> {
  const incidentContext = events
    .map((e) => `${e.title} (${e.severityLevel}) at ${e.locationText} - ${e.sitRepText ?? "REPORTED"}`)
    .join("; ");

  const resourceContext = resources
    .map((r) => `${r.name}: ${r.quantity} ${r.unit} at ${r.address}`)
    .join("; ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiRequestTimeoutMs);

  const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.groqQwenModel,
      temperature: 0,
      max_tokens: 600,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: advisorySystemPrompt },
        {
          role: "user",
          content: `Active incidents: ${incidentContext}. Available resources: ${resourceContext}. Generate 5-7 concise safety advisories for the community.`
        }
      ]
    }),
    signal: controller.signal
  });

  clearTimeout(timeout);

  if (!response.ok) return [];

  const payload = await response.json();
  const content = stripThinkingTagsFromJson(payload.choices?.[0]?.message?.content ?? "");

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.advisories) ? parsed.advisories.slice(0, 7) : [];
  } catch {
    return [];
  }
}

const RESOURCE_SELECT = {
  id: true,
  name: true,
  category: true,
  quantity: true,
  unit: true,
  status: true,
  address: true,
  latitude: true,
  longitude: true
} as const;

export async function generateSitRep(
  lat?: number,
  lng?: number,
  radiusKm?: number
): Promise<SitRepResponse> {
  let events = await prisma.crisisEvent.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: [{ severityLevel: "desc" }, { createdAt: "desc" }]
  });

  if (lat && lng && radiusKm) {
    events = filterByRadius(events, lat, lng, radiusKm);
  }

  const rawResources = await prisma.resource.findMany({
    where: { status: { in: ["Available", "Low Stock"] } },
    select: RESOURCE_SELECT
  });

  const nearbyResources: ResourceSummary[] = lat && lng
    ? attachDistances(rawResources, lat, lng, radiusKm ?? DEFAULT_NEARBY_RADIUS_KM)
    : rawResources;

  const blueprint: SitRepBlueprint = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    threatLevel: computeThreatLevel(events),
    metrics: buildMetricsData(events, nearbyResources.length),
    pulseMap: buildPulseMapData(events),
    timeline: buildTimelineData(events),
    warnings: buildWarningsData(events),
    resources: buildResourcesData(nearbyResources),
    advisories: DEFAULT_ADVISORIES
  };

  try {
    const aiAdvisories = await generateAiAdvisories(events, nearbyResources);
    if (aiAdvisories.length > 0) {
      blueprint.advisories = aiAdvisories;
    }
  } catch {
    /* keep default advisories */
  }

  return { blueprint };
}

export async function getIncidentDetail(
  incidentId: string
): Promise<IncidentDetailResponse | null> {
  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: incidentId }
  });

  if (!crisisEvent) return null;

  const eventReportLinks = await prisma.crisisEventReport.findMany({
    where: { crisisEventId: incidentId },
    include: { incidentReport: true },
    orderBy: { createdAt: "asc" }
  });

  const reports = eventReportLinks.map((link) => link.incidentReport);
  const reporterIds = Array.from(new Set(reports.map((r) => r.reporterId).filter(Boolean)));
  const reporterMap = buildReporterMap(await fetchReporters(reporterIds));

  const contributingReports: IncidentReportListItem[] = reports.map((report) => ({
    id: report.id,
    reporterId: report.reporterId,
    reporterName: reporterMap.get(report.reporterId) ?? "Community Member",
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
  }));

  let nearbyResources: ResourceSummary[] = [];

  if (crisisEvent.latitude != null && crisisEvent.longitude != null) {
    const allResources = await prisma.resource.findMany({
      where: { status: { in: ["Available", "Low Stock"] } }
    });

    nearbyResources = attachDistances(
      allResources,
      crisisEvent.latitude,
      crisisEvent.longitude,
      DEFAULT_NEARBY_RADIUS_KM
    );
  }

  return { crisisEvent, contributingReports, nearbyResources };
}
