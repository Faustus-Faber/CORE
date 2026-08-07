import type { NextFunction, Request, Response } from "express";

import {
  type CriticalIncidentEvent,
  subscribeToCriticalIncidents
} from "../lib/criticalIncidentStream.js";
import {
  getDashboardFeed,
  generateSitRep,
  getAiAdvisories,
  getIncidentDetail
} from "../services/dashboardService.js";
import { haversineDistanceKm } from "../utils/geo.js";
import {
  validateDashboardFeedQuery,
  validateIncidentId
} from "../utils/validation.js";

const SSE_KEEPALIVE_MS = 30000;

function isEventWithinRadius(
  event: CriticalIncidentEvent,
  subscriberLat: number | undefined,
  subscriberLng: number | undefined,
  radiusKm: number | undefined
): boolean {
  if (subscriberLat == null || subscriberLng == null || radiusKm == null) return true;
  if (event.latitude == null || event.longitude == null) return true;
  return haversineDistanceKm(subscriberLat, subscriberLng, event.latitude, event.longitude) <= radiusKm;
}

function requireUserId(request: Request, response: Response): string | null {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

function parseOptionalFloat(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getFeed(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!requireUserId(request, response)) return;

  const filters = validateDashboardFeedQuery(request.query) as ReturnType<typeof validateDashboardFeedQuery> & { organizationId?: string };
  // FR-01: Organization scope — NGO users only see their org's crises
  if (request.authUser?.organizationId) {
    filters.organizationId = request.authUser.organizationId;
  }
  const feed = await getDashboardFeed(filters, request.authUser?.role);

  // §15.1: Pagination — no unbounded feeds
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const total = feed.length;
  const paginated = feed.slice((page - 1) * limit, page * limit);

  return response.status(200).json({
    feed: paginated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getSitRep(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!requireUserId(request, response)) return;

  const lat = parseOptionalFloat(request.query.lat);
  const lng = parseOptionalFloat(request.query.lng);
  const radius = parseOptionalFloat(request.query.radius);

  const sitrep = await generateSitRep(lat, lng, radius, request.authUser?.role);

  return response.status(200).json(sitrep);
}

export async function getAdvisories(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!requireUserId(request, response)) return;

  const lat = parseOptionalFloat(request.query.lat);
  const lng = parseOptionalFloat(request.query.lng);
  const radius = parseOptionalFloat(request.query.radius);

  const result = await getAiAdvisories(lat, lng, radius);

  return response.status(200).json(result);
}

export function streamCriticalIncidents(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!requireUserId(request, response)) return;

  const lat = parseOptionalFloat(request.query.lat);
  const lng = parseOptionalFloat(request.query.lng);
  const radiusKm = parseOptionalFloat(request.query.radius);

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();

  const unsubscribe = subscribeToCriticalIncidents((event) => {
    if (!isEventWithinRadius(event, lat, lng, radiusKm)) return;
    // Guard against writing to a closed/ended response — the client may have
    // disconnected between keepalive checks.
    try {
      if (!response.writableEnded) {
        response.write(`event: critical-incident\ndata: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      // Connection closed — cleanup will handle unsubscribe
    }
  });

  const keepAlive = setInterval(() => {
    try {
      if (!response.writableEnded) {
        response.write(": keepalive\n\n");
      } else {
        clearInterval(keepAlive);
      }
    } catch {
      clearInterval(keepAlive);
    }
  }, SSE_KEEPALIVE_MS);

  const cleanup = () => {
    clearInterval(keepAlive);
    unsubscribe();
  };

  request.on("close", cleanup);
  request.on("aborted", cleanup);
  response.on("error", cleanup);
}

export async function getIncidentById(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!requireUserId(request, response)) return;

  const incidentId = validateIncidentId(request.params.id as string);
  const page = Math.max(1, Number(request.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 50)));
  const detail = await getIncidentDetail(incidentId, request.authUser?.role, page, limit);

  if (!detail) {
    return response.status(404).json({ message: "Incident not found" });
  }

  return response.status(200).json({ incident: detail });
}
