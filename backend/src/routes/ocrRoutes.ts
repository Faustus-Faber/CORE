import { Router } from "express";
import multer from "multer";

import * as ocrController from "../controllers/ocrController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

ocrRoutes.post("/upload", upload.single("image"), asyncHandler(ocrController.scanUpload));
ocrRoutes.post("/folders/:folderId/files/:fileId", asyncHandler(ocrController.scanExistingFolderFile));
ocrRoutes.get("/history", asyncHandler(ocrController.listHistory));
ocrRoutes.get("/:scanId", asyncHandler(ocrController.getScan));
ocrRoutes.patch("/:scanId/attach", asyncHandler(ocrController.attachScan));
ocrRoutes.patch("/:scanId/items/:itemId", asyncHandler(ocrController.updateItem));