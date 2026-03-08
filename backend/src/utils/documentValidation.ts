import { z } from "zod";

export const createFolderSchema = z.object({
    name: z.string().min(1, "Folder name is required").max(80, "Max 80 characters"),
    description: z.string().max(500, "Max 500 characters").optional(),
    crisisId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Crisis ID").optional()
});

export const addNoteSchema = z.object({
    content: z.string().min(1, "Note cannot be empty").max(2000, "Max 2000 characters"),
    gpsLat: z.number().min(-90).max(90).optional(),
    gpsLng: z.number().min(-180).max(180).optional()
});

export const addFileSchema = z.object({
    fileUrl: z.string().url(),
    fileType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]),
    sizeBytes: z.number().max(20 * 1024 * 1024, "File size must be <= 20MB"),
    gpsLat: z.number().min(-90).max(90).optional(),
    gpsLng: z.number().min(-180).max(180).optional()
});

export const shareLinkSchema = z.object({
    expiresIn: z.enum(["1h", "24h", "7d", "never"])
});