import multer from "multer";
import { Router } from "express";
import {
  createEvidencePost,
  listEvidencePosts,
  updateEvidencePost,
  deleteEvidencePost,
  verifyEvidencePost,
  flagEvidencePost
} from "../controllers/evidenceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { uploadRateLimiter } from "../middleware/rateLimiter.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for videos
  },
  fileFilter: (_req, file, cb) => {
    // Only allow image and video file types
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  }
});

export const evidenceRoutes = Router();

evidenceRoutes.get("/", requireAuth, asyncHandler(listEvidencePosts));

evidenceRoutes.post(
  "/",
  requireAuth,
  requireRole("VOLUNTEER", "ADMIN"),
  uploadRateLimiter,
  upload.array("media", 5),
  asyncHandler(createEvidencePost)
);

evidenceRoutes.patch("/:id", requireAuth, asyncHandler(updateEvidencePost));
evidenceRoutes.delete("/:id", requireAuth, asyncHandler(deleteEvidencePost));
evidenceRoutes.post("/:id/verify", requireAuth, requireRole("ADMIN"), asyncHandler(verifyEvidencePost));
evidenceRoutes.post("/:id/flag", requireAuth, asyncHandler(flagEvidencePost));
