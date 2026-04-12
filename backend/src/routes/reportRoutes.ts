import multer from "multer";
import { Router } from "express";

import {
  createReport,
  getMapReports,
  getReportDetail,
  listMyReports,
  listReports
} from "../controllers/reportController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_PATTERN = /^(image|video|audio)\//;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_PATTERN.test(file.mimetype));
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
