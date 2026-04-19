import type { NextFunction, Request, Response } from "express";

import {
  submitCrisisUpdate,
  getCrisisUpdates,
  dismissFlaggedUpdate,
  revertCrisisStatus,
  type ValidatedCrisisUpdateInput
} from "../services/crisisUpdateService.js";
import { validateCrisisUpdateInput } from "../utils/validation.js";

function requireUserId(request: Request, response: Response): string | null {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

function normalizeEmpty<T extends string>(value: T | "" | undefined): T | undefined {
  return value === "" || value === undefined ? undefined : value;
}

function toValidatedInput(raw: unknown): ValidatedCrisisUpdateInput {
  const parsed = validateCrisisUpdateInput(raw);
  return {
    status: parsed.status,
    updateNote: parsed.updateNote,
    newSeverity: parsed.newSeverity,
    affectedArea: normalizeEmpty(parsed.affectedArea),
    casualtyCount: parsed.casualtyCount,
    displacedCount: parsed.displacedCount,
    damageNotes: normalizeEmpty(parsed.damageNotes)
  };
}

function paramAsString(param: unknown): string {
  return Array.isArray(param) ? (param[0] as string) : (param as string);
}

export async function createUpdate(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const crisisEventId = paramAsString(request.params.id);
  const validated = toValidatedInput(request.body);

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
  const crisisEventId = paramAsString(request.params.id);
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

  const updateId = paramAsString(request.params.updateId);
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

  const crisisEventId = paramAsString(request.params.id);
  const { targetStatus, note } = request.body;

  if (typeof targetStatus !== "string" || typeof note !== "string") {
    return response.status(400).json({ message: "targetStatus and note are required" });
  }

  try {
    await revertCrisisStatus(crisisEventId, targetStatus, userId, note);
    return response.status(200).json({ message: "Status reverted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revert status";
    return response.status(400).json({ message });
  }
}
