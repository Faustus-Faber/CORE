import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  generateReport,
  getReport,
  listReports,
  openReportFile
} from "../controllers/ngoReportController.js";

export const ngoReportRoutes = Router();

ngoReportRoutes.get("/", requireAuth, asyncHandler(listReports));
ngoReportRoutes.get("/:id/file", requireAuth, asyncHandler(openReportFile));
ngoReportRoutes.get("/:id", requireAuth, asyncHandler(getReport));
ngoReportRoutes.post("/:crisisId", requireAuth, requireRole("ADMIN"), asyncHandler(generateReport));
