import type { Request, Response } from "express";
import * as docService from "../services/docService.js";
import {
    createFolderSchema,
    addNoteSchema,
    shareFolderSchema
} from "../utils/validation.js";

export async function listFolders(req: Request, res: Response) {
    const userId = req.authUser!.userId;
    const folders = await docService.getUserFolders(userId);
    res.json(folders);
}

export async function createFolder(req: Request, res: Response) {
    const userId = req.authUser!.userId;
    const validatedData = createFolderSchema.parse(req.body);

    const folder = await docService.createFolder(userId, validatedData);
    res.status(201).json(folder);
}

export async function getFolder(req: Request, res: Response) {
    const folderId = req.params.folderId as string;
    const userId = req.authUser!.userId;

    const folder = await docService.getFolderDetails(userId, folderId);
    res.json(folder);
}

export async function uploadFile(req: Request, res: Response) {
    const folderId = req.params.folderId as string;
    const userId = req.authUser!.userId;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const savedFile = await docService.addFileToFolder(userId, folderId, {
        // file.filename comes from diskStorage (the unique name)
        // file.originalname is what the user called it (e.g., "vacation.jpg")
        url: `/uploads/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        lat: req.body.lat ? parseFloat(req.body.lat) : null,
        lng: req.body.lng ? parseFloat(req.body.lng) : null
    });

    res.status(201).json(savedFile);
}
export async function addNote(req: Request, res: Response) {
    const folderId = req.params.folderId as string;
    const userId = req.authUser!.userId;
    const validatedData = addNoteSchema.parse(req.body);

    const note = await docService.addNoteToFolder(userId, folderId, validatedData);
    res.status(201).json(note);
}

export async function shareFolder(req: Request, res: Response) {
    const folderId = req.params.folderId as string;
    const userId = req.authUser!.userId;
    const { expiresInHours } = shareFolderSchema.parse(req.body);

    const tokenData = await docService.generateShareLink(userId, folderId, Number(expiresInHours));

    const baseUrl = process.env.CORS_ORIGIN || "http://localhost:5173";
    res.json({
        shareUrl: `${baseUrl}/shared/${tokenData.token}`, // FIXED: Removed "share" prefix
        expiresAt: tokenData.expiresAt                    // FIXED: Removed "share" prefix
    });
}

export async function revokeShare(req: Request, res: Response) {
    const folderId = req.params.folderId as string;
    const userId = req.authUser!.userId;

    await docService.revokeShareLink(userId, folderId);
    res.status(204).send();
}

export async function deleteFolder(req: Request, res: Response) {
    const folderId = req.params.folderId as string;
    const userId = req.authUser!.userId;
    const permanent = req.query.permanent === "true";

    if (permanent) {
        await docService.permanentlyDeleteFolder(userId, folderId);
    } else {
        await docService.softDeleteFolder(userId, folderId);
    }

    res.status(204).send();
}

export async function deleteFile(req: Request, res: Response) {
    // FIX: Add 'as string' to satisfy TypeScript
    const fileId = req.params.fileId as string;
    const userId = req.authUser!.userId;

    // Requirement: Soft-delete individual files
    await docService.softDeleteFile(userId, fileId);
    res.status(204).send();
}

export async function deleteNote(req: Request, res: Response) {
    // FIX: Add 'as string' to satisfy TypeScript
    const noteId = req.params.noteId as string;
    const userId = req.authUser!.userId;

    // Requirement: Soft-delete individual notes
    await docService.softDeleteNote(userId, noteId);
    res.status(204).send();
}