import multer from "multer";
import { Router } from "express";

import {
  attachScan,
  getScan,
  listHistory,
  scanExistingFolderFile,
  scanUpload,
  updateItem
} from "../controllers/ocrController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("OCR supports JPG, PNG, and WEBP images only"));
  }
});

export const ocrRoutes = Router();

ocrRoutes.use(requireAuth);

ocrRoutes.get("/history", asyncHandler(listHistory));
ocrRoutes.post("/upload", upload.single("image"), asyncHandler(scanUpload));
ocrRoutes.post(
  "/folders/:folderId/files/:fileId",
  asyncHandler(scanExistingFolderFile)
);
ocrRoutes.get("/:scanId", asyncHandler(getScan));
ocrRoutes.patch("/:scanId/attach", asyncHandler(attachScan));
ocrRoutes.patch("/:scanId/items/:itemId", asyncHandler(updateItem));
