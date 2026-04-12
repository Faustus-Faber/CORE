import type { NextFunction, Request, Response } from "express";

import {
  getDashboardFeed,
  generateSitRep,
  getIncidentDetail
} from "../services/dashboardService.js";
import {
  validateDashboardFeedQuery,
  validateIncidentId
} from "../utils/validation.js";

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
