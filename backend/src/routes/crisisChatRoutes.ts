import { Router, type Request, type Response } from "express";

import {
  listCrisisMessages,
  createCrisisMessage,
  deleteCrisisMessage,
  togglePinCrisisMessage,
} from "../services/crisisChatService.js";
import { subscribeToCrisisChat } from "../lib/crisisChatStream.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiRateLimiter, signalRateLimiter } from "../middleware/rateLimiter.js";

export const crisisChatRoutes = Router();

const SSE_KEEPALIVE_MS = 15_000;

// ── List messages (paginated) ───────────────────────────────────────────────
crisisChatRoutes.get(
  "/:id/messages",
  requireAuth,
  apiRateLimiter,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.id);
    const page = Math.max(1, Number(request.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 50)));
    const result = await listCrisisMessages(crisisEventId, page, limit);
    return response.status(200).json(result);
  })
);

// ── Send a message ──────────────────────────────────────────────────────────
crisisChatRoutes.post(
  "/:id/messages",
  requireAuth,
  requireRole("VOLUNTEER", "ADMIN"),
  signalRateLimiter,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.id);
    const senderId = request.authUser!.userId;
    const { content } = request.body as { content?: string };
    if (!content || typeof content !== "string") {
      return response.status(400).json({ message: "content is required" });
    }
    const message = await createCrisisMessage(crisisEventId, senderId, content);
    return response.status(201).json({ message: "Message sent", data: message });
  })
);

// ── SSE stream for real-time messages ───────────────────────────────────────
crisisChatRoutes.get(
  "/:id/messages/stream",
  requireAuth,
  (request: Request, response: Response) => {
    const crisisEventId = String(request.params.id);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    // Send initial connection event
    try {
      response.write(`event: connected\ndata: ${JSON.stringify({ crisisEventId })}\n\n`);
    } catch {
      // client may have disconnected
    }

    const unsubscribe = subscribeToCrisisChat(crisisEventId, (event) => {
      try {
        if (!response.writableEnded) {
          response.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
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
);

// ── Delete a message (admin only) ───────────────────────────────────────────
crisisChatRoutes.delete(
  "/messages/:messageId",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const adminId = request.authUser!.userId;
    await deleteCrisisMessage(String(request.params.messageId), adminId);
    return response.status(200).json({ message: "Message deleted" });
  })
);

// ── Toggle pin on a message (admin only) ────────────────────────────────────
crisisChatRoutes.patch(
  "/messages/:messageId/pin",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const result = await togglePinCrisisMessage(String(request.params.messageId));
    return response.status(200).json({ message: "Pin toggled", ...result });
  })
);
