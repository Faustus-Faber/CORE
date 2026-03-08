import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { createFolderSchema, addNoteSchema } from "../utils/validation.js";

export async function createFolder(ownerId: string, payload: unknown) {
    const parsed = createFolderSchema.parse(payload);
    return prisma.secureFolder.create({
        data: {
            name: parsed.name,
            description: parsed.description,
            crisisId: parsed.crisisId,
            ownerId,
        },
    });
}

export async function getUserFolders(ownerId: string) {
    return prisma.secureFolder.findMany({
        where: { ownerId, isDeleted: false },
        include: {
            _count: { select: { files: true, notes: true } }
        },
        orderBy: { updatedAt: 'desc' }
    });
}

export async function getFolderDetails(ownerId: string, folderId: string) {
    const folder = await prisma.secureFolder.findFirst({
        where: { id: folderId, ownerId, isDeleted: false },
        include: {
            files: { where: { isDeleted: false } },
            notes: { where: { isDeleted: false } }
        }
    });

    if (!folder) throw new Error("Folder not found or access denied");
    return folder;
}

export async function addNoteToFolder(authorId: string, folderId: string, payload: unknown) {
    const parsed = addNoteSchema.parse(payload);
    await getFolderDetails(authorId, folderId);

    return prisma.folderNote.create({
        data: {
            content: parsed.content,
            gpsLat: parsed.lat,
            gpsLng: parsed.lng,
            folderId,
            authorId
        }
    });
}

export async function generateShareLink(ownerId: string, folderId: string, hours: number) {
    await getFolderDetails(ownerId, folderId);
    const token = randomBytes(32).toString("hex");
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;

    return prisma.shareLink.create({
        data: { folderId, token, expiresAt }
    });
}

export async function softDeleteFolder(ownerId: string, folderId: string) {
    return prisma.secureFolder.update({
        where: { id: folderId, ownerId },
        data: { isDeleted: true, deletedAt: new Date() }
    });
}

// --- NEWLY ADDED FUNCTIONS ---

export async function addFileToFolder(ownerId: string, folderId: string, fileData: {
    url: string;
    fileName: string; // The original name from Multer
    fileSize: number;
    mimeType: string;
    lat: number | null;
    lng: number | null;
}) {
    await getFolderDetails(ownerId, folderId);

    return prisma.folderFile.create({
        data: {
            folderId,
            uploaderId: ownerId,
            fileUrl: fileData.url,     // e.g., /uploads/171000-image.png
            fileType: fileData.mimeType,
            sizeBytes: fileData.fileSize,
            gpsLat: fileData.lat,
            gpsLng: fileData.lng,
            // fileName is REMOVED because it's not in your schema
        }
    });
}
export async function revokeShareLink(ownerId: string, folderId: string) {
    await getFolderDetails(ownerId, folderId); // Verify ownership

    return prisma.shareLink.updateMany({
        where: { folderId, isRevoked: false },
        data: { isRevoked: true }
    });
}

export async function permanentlyDeleteFolder(ownerId: string, folderId: string) {
    return prisma.secureFolder.delete({
        where: { id: folderId, ownerId }
    });
}

export async function softDeleteFile(uploaderId: string, fileId: string) {
    return prisma.folderFile.update({
        where: { id: fileId, uploaderId },
        data: { isDeleted: true, deletedAt: new Date() }
    });
}

export async function softDeleteNote(authorId: string, noteId: string) {
    return prisma.folderNote.update({
        where: { id: noteId, authorId },
        data: { isDeleted: true, deletedAt: new Date() }
    });
}