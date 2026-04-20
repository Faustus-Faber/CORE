import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  generateReport,
  getReport,
  listReports
} from "../controllers/ngoReportController.js";

export const ngoReportRoutes = Router();

ngoReportRoutes.get("/", requireAuth, asyncHandler(listReports));
ngoReportRoutes.get("/:id", requireAuth, asyncHandler(getReport));
ngoReportRoutes.post("/:crisisId", requireAuth, requireAdmin, asyncHandler(generateReport));
