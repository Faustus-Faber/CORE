import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  generateReport,
  createDraft,
  updateSections,
  generatePDF,
  getReport,
  listReports,
  openReportFile
} from "../controllers/ngoReportController.js";

export const ngoReportRoutes = Router();

ngoReportRoutes.get("/", requireAuth, asyncHandler(listReports));
ngoReportRoutes.get("/:id/file", requireAuth, asyncHandler(openReportFile));
ngoReportRoutes.get("/:id", requireAuth, asyncHandler(getReport));

// Create a draft after-action report with editable sections (admin only)
ngoReportRoutes.post("/crises/:crisisId/draft", requireAuth, requireRole("ADMIN"), asyncHandler(createDraft));

// Update editable sections of a report (admin only)
ngoReportRoutes.patch("/:reportId/sections", requireAuth, requireRole("ADMIN"), asyncHandler(updateSections));

// Generate the final PDF from edited sections (admin only)
ngoReportRoutes.post("/:reportId/generate-pdf", requireAuth, requireRole("ADMIN"), asyncHandler(generatePDF));

// Legacy: generate PDF directly (admin only)
ngoReportRoutes.post("/:crisisId", requireAuth, requireRole("ADMIN"), asyncHandler(generateReport));
