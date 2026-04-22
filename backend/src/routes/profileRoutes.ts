import { Router } from "express";

import {
  updateCurrentPassword,
  updateCurrentProfile,
  toggleDispatchOptIn,
  getMyDispatchLogs
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

profileRoutes.patch("/dispatch-opt-in", requireAuth, asyncHandler(toggleDispatchOptIn));
profileRoutes.get("/dispatch-logs", requireAuth, asyncHandler(getMyDispatchLogs));
// Backward compatibility for older frontend clients.
profileRoutes.get("/sms-logs", requireAuth, asyncHandler(getMyDispatchLogs));
