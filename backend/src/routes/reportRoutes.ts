import multer from "multer";
import { Router } from "express";
import { getMapReports, getReportDetail } from "../controllers/reportController.js";

import {
  createReport,
  listMyReports,
  listReports
} from "../controllers/reportController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

export const reportRoutes = Router();

reportRoutes.get("/", requireAuth, asyncHandler(listReports));
reportRoutes.get("/mine", requireAuth, asyncHandler(listMyReports));
reportRoutes.get("/map", requireAuth, asyncHandler(getMapReports));
reportRoutes.get("/:id", requireAuth, asyncHandler(getReportDetail));

reportRoutes.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "media", maxCount: 5 },
    { name: "voiceNote", maxCount: 1 }
  ]),
  asyncHandler(createReport)
);
