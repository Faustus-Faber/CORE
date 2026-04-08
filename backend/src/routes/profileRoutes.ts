import { Router } from "express";

import {
  updateCurrentPassword,
  updateCurrentProfile
} from "../controllers/profileController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const profileRoutes = Router();

profileRoutes.patch("/", requireAuth, asyncHandler(updateCurrentProfile));
profileRoutes.post(
  "/change-password",
  requireAuth,
  asyncHandler(updateCurrentPassword)
);
