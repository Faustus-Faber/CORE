import { Router } from "express";

import {
  createUpdate,
  listUpdates,
  dismissUpdate,
  revertStatus
} from "../controllers/crisisUpdateController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const crisisUpdateRoutes = Router();

crisisUpdateRoutes.post(
  "/:id/updates",
  requireAuth,
  asyncHandler(createUpdate)
);

crisisUpdateRoutes.get(
  "/:id/updates",
  requireAuth,
  asyncHandler(listUpdates)
);

crisisUpdateRoutes.patch(
  "/updates/:updateId/dismiss",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(dismissUpdate)
);

crisisUpdateRoutes.patch(
  "/:id/revert",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(revertStatus)
);
