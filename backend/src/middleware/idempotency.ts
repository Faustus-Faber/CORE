/**
 * Idempotency-Key middleware.
 *
 * If a request includes an `Idempotency-Key` header, the middleware checks
 * if a record already exists for that key + user + operation. If so, it
 * returns the cached result instead of re-executing the request.
 */

import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const IDEMPOTENCY_HEADER = "idempotency-key";
const KEY_TTL_HOURS = 24;

/**
 * Middleware that checks for an Idempotency-Key header.
 * If found and a previous result exists, returns it.
 * Otherwise, allows the request through and stores the result.
 */
export async function idempotencyCheck(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const key = request.headers[idempotencyHeader()] as string | undefined;
  if (!key) return next();

  const userId = request.authUser?.userId;
  // Skip idempotency for unauthenticated requests — without a userId we can't
  // safely scope the key, and allowing undefined would let one anonymous user
  // collide with another's cached result.
  if (!userId) return next();

  const operation = `${request.method}:${request.path}`;

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { id: key }
    });

    if (existing) {
      // Check if the key belongs to the same user and operation
      if (existing.userId === userId && existing.operation === operation) {
        if (existing.state === "COMPLETED" && existing.resultId) {
          return response.status(200).json({
            idempotent: true,
            resultId: existing.resultId,
            message: "Request already processed"
          });
        }
        if (existing.state === "PROCESSING") {
          return response.status(409).json({
            error: {
              code: "IDEMPOTENCY_IN_PROGRESS",
              message: "A request with this key is already being processed",
              retryable: true
            }
          });
        }
      }
      // Key exists but for different user/operation — reject
      return response.status(409).json({
        error: {
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "Idempotency key already in use for a different operation",
          retryable: false
        }
      });
    }

    // Create a PROCESSING record
    await prisma.idempotencyKey.create({
      data: {
        id: key,
        userId,
        operation,
        state: "PROCESSING",
        expiresAt: new Date(Date.now() + KEY_TTL_HOURS * 60 * 60 * 1000)
      }
    });

    // Attach the key to the request so the handler can complete it
    (request as any).idempotencyKey = key;
  } catch (err) {
    // If we can't check idempotency (DB error), proceed without it
    console.error("[idempotency] Check failed:", err);
  }

  return next();
}

/**
 * Complete an idempotent request by storing the result.
 * Call this after the main operation succeeds.
 */
export async function completeIdempotentRequest(
  request: Request,
  resultId: string
): Promise<void> {
  const key = (request as any).idempotencyKey as string | undefined;
  if (!key) return;

  try {
    await prisma.idempotencyKey.update({
      where: { id: key },
      data: { state: "COMPLETED", resultId }
    });
  } catch (err) {
    // Non-critical — the operation already succeeded, but log so we can detect
    // persistent DB issues that would leave keys stuck in PROCESSING state.
    console.error("[idempotency] Failed to mark request as completed:", err);
  }
}

function idempotencyHeader(): string {
  return IDEMPOTENCY_HEADER;
}
