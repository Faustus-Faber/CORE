import type { NextFunction, Request, Response } from "express";

import {
  getMyResponderStatus,
  listCrisisResponders,
  upsertCrisisResponderStatus
} from "../services/crisisResponderService.js";
import { validateCrisisResponderStatusInput } from "../utils/validation.js";

function requireUserId(request: Request, response: Response): string | null {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

function paramAsString(param: unknown): string {
  return Array.isArray(param) ? (param[0] as string) : (param as string);
}

export async function listResponders(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const crisisEventId = paramAsString(request.params.id);
  const includeUnavailable = request.authUser?.role === "ADMIN";

  const [responders, myStatus] = await Promise.all([
    listCrisisResponders(crisisEventId, includeUnavailable),
    request.authUser?.role === "VOLUNTEER"
      ? getMyResponderStatus(crisisEventId, userId)
      : Promise.resolve(null)
  ]);

  return response.status(200).json({ responders, myStatus });
}

export async function updateMyResponderStatus(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const volunteerId = requireUserId(request, response);
  if (!volunteerId) return;

  const crisisEventId = paramAsString(request.params.id);
  const { status } = validateCrisisResponderStatusInput(request.body);

  const responder = await upsertCrisisResponderStatus(
    crisisEventId,
    volunteerId,
    status
  );

  return response.status(200).json({
    message: "Responder status updated",
    responder
  });
}
