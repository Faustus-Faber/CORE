import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as docController from "../controllers/docController.js";
import { upload } from "../middleware/upload.js"; // Import your multer config

export const docRoutes = Router();

// All routes require authentication
docRoutes.use(requireAuth);

// Folders
docRoutes.get("/", asyncHandler(docController.listFolders));
docRoutes.post("/", asyncHandler(docController.createFolder));
docRoutes.get("/:folderId", asyncHandler(docController.getFolder));
docRoutes.delete("/:folderId", asyncHandler(docController.deleteFolder));

// Notes & Files
docRoutes.post("/:folderId/notes", asyncHandler(docController.addNote));
docRoutes.post("/:folderId/files", upload.single("file"), asyncHandler(docController.uploadFile));

// Sharing
docRoutes.post("/:folderId/share", asyncHandler(docController.shareFolder));
docRoutes.delete("/:folderId/share", asyncHandler(docController.revokeShare));
// Add these to docRoutes.ts
docRoutes.delete("/:folderId/files/:fileId", asyncHandler(docController.deleteFile));
docRoutes.delete("/:folderId/notes/:noteId", asyncHandler(docController.deleteNote));
// Folders
docRoutes.get("/", asyncHandler(docController.listFolders));
docRoutes.delete("/:folderId", asyncHandler(docController.deleteFolder));

// Notes & Files
docRoutes.post("/:folderId/files", upload.single("file"), asyncHandler(docController.uploadFile));

// ADD THIS LINE HERE:
docRoutes.delete("/:folderId/files/:fileId", asyncHandler(docController.deleteFile));