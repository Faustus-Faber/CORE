import { Router } from "express";

import {
  updatePreferences,
  getPreferences,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  triggerDispatch
} from "../controllers/notificationController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationRoutes = Router();

notificationRoutes.get("/preferences", requireAuth, asyncHandler(getPreferences));
notificationRoutes.put("/preferences", requireAuth, asyncHandler(updatePreferences));
notificationRoutes.get("/inbox", requireAuth, asyncHandler(listNotifications));
notificationRoutes.patch("/inbox/:id/read", requireAuth, asyncHandler(markNotificationRead));
notificationRoutes.post("/inbox/read-all", requireAuth, asyncHandler(markAllNotificationsRead));
notificationRoutes.post("/dispatch", requireAuth, asyncHandler(triggerDispatch));
