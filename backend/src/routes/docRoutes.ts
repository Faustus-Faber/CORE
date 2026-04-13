import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as docController from "../controllers/docController.js";
import { upload } from "../middleware/upload.js"; // Import your multer config

export const docRoutes = Router();

// Public routes
docRoutes.get("/shared/:token", asyncHandler(docController.getSharedFolder));

// All other routes require authentication
docRoutes.use(requireAuth);

// Folders
docRoutes.get("/", asyncHandler(docController.listFolders));
docRoutes.get("/active-crises", asyncHandler(docController.getActiveCrises));
docRoutes.post("/", asyncHandler(docController.createFolder));
docRoutes.get("/:folderId", asyncHandler(docController.getFolder));
docRoutes.delete("/:folderId", asyncHandler(docController.deleteFolder));
docRoutes.post("/:folderId/restore", asyncHandler(docController.restoreFolder));
docRoutes.post("/:folderId/pin", asyncHandler(docController.togglePin));

// Notes & Files
docRoutes.post("/:folderId/notes", asyncHandler(docController.addNote));
docRoutes.post("/:folderId/files", upload.single("file"), asyncHandler(docController.uploadFile));

// Sharing
docRoutes.post("/:folderId/share", asyncHandler(docController.shareFolder));
docRoutes.delete("/:folderId/share", asyncHandler(docController.revokeShare));

// Individual Item Operations
docRoutes.delete("/:folderId/files/:fileId", asyncHandler(docController.deleteFile));
docRoutes.post("/:folderId/files/:fileId/restore", asyncHandler(docController.restoreFile));
docRoutes.patch("/:folderId/files/:fileId", asyncHandler(docController.updateFileDescription));

docRoutes.delete("/:folderId/notes/:noteId", asyncHandler(docController.deleteNote));
docRoutes.post("/:folderId/notes/:noteId/restore", asyncHandler(docController.restoreNote));