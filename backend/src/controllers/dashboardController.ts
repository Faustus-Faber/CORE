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

export async function getFeed(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;
  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const filters = validateDashboardFeedQuery(request.query);

  const feed = await getDashboardFeed(filters);

  return response.status(200).json({ feed });
}

export async function getSitRep(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;
  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const lat = request.query.lat ? parseFloat(request.query.lat as string) : undefined;
  const lng = request.query.lng ? parseFloat(request.query.lng as string) : undefined;
  const radius = request.query.radius
    ? parseFloat(request.query.radius as string)
    : undefined;

  const sitrep = await generateSitRep(lat, lng, radius);

  return response.status(200).json(sitrep);
}

export async function getIncidentById(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;
  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const incidentId = validateIncidentId(request.params.id as string);

  const detail = await getIncidentDetail(incidentId);

  if (!detail) {
    return response.status(404).json({ message: "Incident not found" });
  }

  return response.status(200).json({ incident: detail });
}