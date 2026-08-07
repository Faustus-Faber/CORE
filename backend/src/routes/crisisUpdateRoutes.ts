import { Router, type Request, type Response } from "express";

import {
  createUpdate,
  listUpdates,
  dismissUpdate,
  revertStatus
} from "../controllers/crisisUpdateController.js";
import { approveFlaggedUpdate } from "../services/crisisUpdateService.js";
import {
  listResponders,
  updateMyResponderStatus
} from "../controllers/crisisResponderController.js";
import { getUnresolvedConflicts, resolveConflict } from "../services/crisisUpdateService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { signalRateLimiter, apiRateLimiter } from "../middleware/rateLimiter.js";

export const crisisUpdateRoutes = Router();

crisisUpdateRoutes.post(
  "/:id/updates",
  requireAuth,
  requireRole("VOLUNTEER", "ADMIN"),
  signalRateLimiter,
  asyncHandler(createUpdate)
);

crisisUpdateRoutes.get(
  "/:id/updates",
  requireAuth,
  apiRateLimiter,
  asyncHandler(listUpdates)
);

crisisUpdateRoutes.get(
  "/:id/responders",
  requireAuth,
  asyncHandler(listResponders)
);

crisisUpdateRoutes.patch(
  "/:id/responders/me",
  requireAuth,
  requireRole("VOLUNTEER"),
  asyncHandler(updateMyResponderStatus)
);

crisisUpdateRoutes.patch(
  "/updates/:updateId/dismiss",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(dismissUpdate)
);

crisisUpdateRoutes.patch(
  "/updates/:updateId/approve",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request: Request, response: Response) => {
    const adminId = request.authUser!.userId;
    const result = await approveFlaggedUpdate(String(request.params.updateId), adminId);
    return response.status(200).json({
      message: `Update approved (+${result.pointsAwarded} points awarded)`,
      ...result
    });
  })
);

crisisUpdateRoutes.patch(
  "/:id/revert",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(revertStatus)
);

// ── Conflict resolution routes (admin) ──────────────────────────────────────
crisisUpdateRoutes.get(
  "/conflicts",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request: Request, response: Response) => {
    const crisisEventId = request.query.crisisEventId as string | undefined;
    const conflicts = await getUnresolvedConflicts(crisisEventId);
    return response.status(200).json({ conflicts });
  })
);

crisisUpdateRoutes.patch(
  "/conflicts/:conflictId/resolve",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request: Request, response: Response) => {
    const adminId = request.authUser!.userId;
    const { acceptedUpdateId } = request.body as { acceptedUpdateId?: string };
    if (!acceptedUpdateId) {
      return response.status(400).json({ message: "acceptedUpdateId is required" });
    }
    await resolveConflict(
      String(request.params.conflictId),
      acceptedUpdateId,
      adminId
    );
    return response.status(200).json({ message: "Conflict resolved" });
  })
);
