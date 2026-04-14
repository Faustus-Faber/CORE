import { Router } from "express";

import {
  createUpdate,
  listUpdates,
  dismissUpdate,
  revertStatus
} from "../controllers/crisisUpdateController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

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
  asyncHandler(dismissUpdate)
);

crisisUpdateRoutes.patch(
  "/:id/revert",
  requireAuth,
  asyncHandler(revertStatus)
);
