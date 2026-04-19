import type { NextFunction, Request, Response } from "express";

import {
  type CriticalIncidentEvent,
  subscribeToCriticalIncidents
} from "../lib/criticalIncidentStream.js";
import {
  getDashboardFeed,
  generateSitRep,
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

  const filters = validateDashboardFeedQuery(request.query);
  const feed = await getDashboardFeed(filters);

  return response.status(200).json({ feed });
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

  const sitrep = await generateSitRep(lat, lng, radius);

  return response.status(200).json(sitrep);
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
    response.write(`event: critical-incident\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => {
    response.write(": keepalive\n\n");
  }, SSE_KEEPALIVE_MS);

  const cleanup = () => {
    clearInterval(keepAlive);
    unsubscribe();
  };

  request.on("close", cleanup);
  request.on("aborted", cleanup);
}

export async function getIncidentById(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!requireUserId(request, response)) return;

  const incidentId = validateIncidentId(request.params.id as string);
  const detail = await getIncidentDetail(incidentId);

  if (!detail) {
    return response.status(404).json({ message: "Incident not found" });
  }

  return response.status(200).json({ incident: detail });
}
