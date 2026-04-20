import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as ocrController from "../controllers/ocrController.js";
import { upload } from "../middleware/upload.js";

export const ocrRoutes = Router();

ocrRoutes.use(requireAuth);

ocrRoutes.post("/extract", upload.single("image"), asyncHandler(ocrController.extractText));
ocrRoutes.post("/save", asyncHandler(ocrController.saveOCR));
ocrRoutes.get("/history", asyncHandler(ocrController.getHistory));
ocrRoutes.get("/file/:fileId", asyncHandler(ocrController.getOCRByFile));
ocrRoutes.patch("/:ocrId", asyncHandler(ocrController.updateOCR));
