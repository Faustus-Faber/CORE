import type { NextFunction, Request, Response } from "express";

import {
  upsertSubscription,
  getSubscription,
  dispatchNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead
} from "../services/notificationService.js";
import { validateNotificationPreferences } from "../utils/validation.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

function requireUserId(request: Request, response: Response): string | null {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

export async function updatePreferences(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const validated = validateNotificationPreferences(request.body);
  await upsertSubscription(userId, validated);

  return response.status(200).json({ message: "Preferences updated" });
}

export async function getPreferences(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const preferences = await getSubscription(userId);

  if (!preferences) {
    return response.status(200).json({
      incidentTypes: [],
      radiusKm: 10,
      isActive: false
    });
  }

  return response.status(200).json(preferences);
}

export async function listNotifications(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const page = Math.max(1, parseInt(request.query.page as string) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(request.query.limit as string) || 20));

  const result = await getNotifications(userId, page, limit);
  return response.status(200).json(result);
}

export async function markNotificationRead(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const notificationId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  await markAsRead(userId, notificationId);
  return response.status(200).json({ message: "Notification marked as read" });
}

export async function markAllNotificationsRead(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  await markAllAsRead(userId);
  return response.status(200).json({ message: "All notifications marked as read" });
}

export async function triggerDispatch(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { crisisEventId, incidentType, severity, title, description, latitude, longitude } =
    request.body;

  if (!crisisEventId || !incidentType) {
    return response.status(400).json({ message: "Missing required fields" });
  }

  await dispatchNotifications(
    crisisEventId,
    incidentType,
    severity ?? "Unknown",
    title ?? "",
    description ?? "",
    latitude ?? null,
    longitude ?? null
  );

  return response.status(200).json({ message: "Notifications dispatched" });
}
