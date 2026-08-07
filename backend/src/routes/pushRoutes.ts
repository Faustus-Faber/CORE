/**
 * Web Push routes — subscription management and VAPID key retrieval.
 *
 * GET  /push/vapid-public-key  → get VAPID public key for frontend subscription
 * POST /push/subscribe         → save a push subscription
 * DELETE /push/unsubscribe     → remove a push subscription
 *
 * Per refinement plan §19 "Should have": web push if fully implemented.
 */

import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  getVapidPublicKey,
  isWebPushConfigured,
  savePushSubscription,
  removePushSubscription,
} from "../services/webPushService.js";

export const pushRoutes = Router();

pushRoutes.use(requireAuth);

/**
 * GET /push/vapid-public-key
 * Returns the VAPID public key for the frontend to use when subscribing.
 */
pushRoutes.get(
  "/vapid-public-key",
  asyncHandler(async (_request: Request, response: Response) => {
    if (!isWebPushConfigured()) {
      return response.status(503).json({
        message: "Web push not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
        configured: false,
      });
    }
    return response.status(200).json({ publicKey: getVapidPublicKey(), configured: true });
  })
);

/**
 * POST /push/subscribe
 * Save a browser push subscription for the authenticated user.
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 */
pushRoutes.post(
  "/subscribe",
  asyncHandler(async (request: Request, response: Response) => {
    const userId = request.authUser!.userId;
    const { endpoint, keys } = request.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return response.status(400).json({ message: "endpoint, keys.p256dh, and keys.auth are required" });
    }

    await savePushSubscription(userId, { endpoint, keys });
    return response.status(201).json({ message: "Push subscription saved" });
  })
);

/**
 * DELETE /push/unsubscribe
 * Remove a push subscription.
 * Body: { endpoint: string }
 */
pushRoutes.delete(
  "/unsubscribe",
  asyncHandler(async (request: Request, response: Response) => {
    const userId = request.authUser?.userId;
    if (!userId) {
      return response.status(401).json({ message: "Authentication required" });
    }
    const { endpoint } = request.body as { endpoint: string };
    if (!endpoint) {
      return response.status(400).json({ message: "endpoint is required" });
    }
    await removePushSubscription(userId, endpoint);
    return response.status(200).json({ message: "Push subscription removed" });
  })
);
