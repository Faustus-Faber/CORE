import multer from "multer";
import { Router } from "express";
import { 
  createEvidencePost, 
  listEvidencePosts, 
  updateEvidencePost, 
  deleteEvidencePost, 
  toggleLikePost, 
  addComment,
  verifyEvidencePost,
  flagEvidencePost
} from "../controllers/evidenceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for videos
  }
});

export const evidenceRoutes = Router();

evidenceRoutes.get("/", requireAuth, asyncHandler(listEvidencePosts));

evidenceRoutes.post(
  "/",
  requireAuth,
  requireRole("VOLUNTEER", "ADMIN"),
  upload.array("media", 5),
  asyncHandler(createEvidencePost)
);

evidenceRoutes.patch("/:id", requireAuth, asyncHandler(updateEvidencePost));
evidenceRoutes.delete("/:id", requireAuth, asyncHandler(deleteEvidencePost));
evidenceRoutes.post("/:id/like", requireAuth, asyncHandler(toggleLikePost));
evidenceRoutes.post("/:id/comment", requireAuth, asyncHandler(addComment));
evidenceRoutes.post("/:id/verify", requireAuth, requireRole("ADMIN"), asyncHandler(verifyEvidencePost));
evidenceRoutes.post("/:id/flag", requireAuth, asyncHandler(flagEvidencePost));
