import type { NextFunction, Request, Response } from "express";

import {
  submitCrisisUpdate,
  getCrisisUpdates,
  dismissFlaggedUpdate,
  revertCrisisStatus
} from "../services/crisisUpdateService.js";
import { validateCrisisUpdateInput } from "../utils/validation.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

function requireUserId(request: Request, response: Response): string | null {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

export async function createUpdate(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const crisisEventId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const validated = validateCrisisUpdateInput(request.body);

  const { entry, isTrusted } = await submitCrisisUpdate(
    crisisEventId,
    userId,
    request.authUser!.role,
    validated
  );

  const status = entry.isFlagged ? 202 : 201;
  return response.status(status).json({ entry, isTrusted });
}

export async function listUpdates(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const crisisEventId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const entries = await getCrisisUpdates(crisisEventId);
  return response.status(200).json({ entries });
}

export async function dismissUpdate(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const updateId = Array.isArray(request.params.updateId) ? request.params.updateId[0] : request.params.updateId;
  await dismissFlaggedUpdate(updateId, userId);
  return response.status(200).json({ message: "Update dismissed" });
}

export async function revertStatus(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const crisisEventId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const { targetStatus, note } = request.body;
  await revertCrisisStatus(crisisEventId, targetStatus, userId, note);
  return response.status(200).json({ message: "Status reverted" });
}
