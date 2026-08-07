import multer from "multer";
import { Router } from "express";

import {
  createReport,
  getMapReports,
  getReportDetail,
  listCrisisEvents,
  listMyReports,
  listReports
} from "../controllers/reportController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";
import { validateMagicBytes } from "../utils/fileValidation.js";
import { idempotencyCheck } from "../middleware/idempotency.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_PATTERN = /^(image|video|audio)\//;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_PATTERN.test(file.mimetype));
  }
});

// P1: Magic-byte validation middleware — rejects files whose content doesn't match their MIME type
function validateFileSignatures(req: any, _res: any, next: any) {
  const filesByField = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (!filesByField) return next();

  for (const [field, files] of Object.entries(filesByField)) {
    for (const file of files) {
      if (!validateMagicBytes(file.buffer, file.mimetype)) {
        return next(new Error(`File "${file.originalname}" failed signature validation (declared ${file.mimetype})`));
      }
    }
  }
  return next();
}

export const reportRoutes = Router();

reportRoutes.get("/", requireAuth, asyncHandler(listReports));
reportRoutes.get("/mine", requireAuth, asyncHandler(listMyReports));
reportRoutes.get("/map", requireAuth, asyncHandler(getMapReports));
// AC-05.04: Crisis event list view — same data source as map, for accessible list alternative
reportRoutes.get("/crisis-events", requireAuth, asyncHandler(listCrisisEvents));
reportRoutes.get("/:id", requireAuth, asyncHandler(getReportDetail));

// P1: Rate limit report submission (AI-driven endpoint)
reportRoutes.post(
  "/",
  requireAuth,
  aiRateLimiter,
  idempotencyCheck,
  upload.fields([
    { name: "media", maxCount: 5 },
    { name: "voiceNote", maxCount: 1 }
  ]),
  validateFileSignatures,
  asyncHandler(createReport)
);
