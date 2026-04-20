import { Router } from "express";

import {
  getCrisesForDropdownHandler,
  getLeaderboardHandler,
  getMyTimesheetHandler,
  getPendingTasksHandler,
  logTaskHandler,
  verifyTaskHandler
} from "../controllers/timesheetController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { upload } from "../middleware/upload.js";

export const timesheetRoutes = Router();

// All timesheet routes require authentication
timesheetRoutes.use(requireAuth);

// ── Public (all authenticated users) ──────────────────────────────────────
timesheetRoutes.get("/leaderboard", asyncHandler(getLeaderboardHandler));
timesheetRoutes.get("/crises", asyncHandler(getCrisesForDropdownHandler));

// ── Volunteer-only ───────────────────────────────────────────────────────
timesheetRoutes.post(
  "/tasks",
  requireRole("VOLUNTEER"),
  upload.array("evidence", 2),
  asyncHandler(logTaskHandler)
);
timesheetRoutes.get("/my", requireRole("VOLUNTEER"), asyncHandler(getMyTimesheetHandler));

// ── Admin-only ────────────────────────────────────────────────────────────
timesheetRoutes.get(
  "/tasks/pending",
  requireRole("ADMIN"),
  asyncHandler(getPendingTasksHandler)
);
timesheetRoutes.patch(
  "/tasks/:id/verify",
  requireRole("ADMIN"),
  asyncHandler(verifyTaskHandler)
);
