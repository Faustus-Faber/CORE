import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { createFolderSchema, addNoteSchema } from "../utils/validation.js";

export async function createFolder(ownerId: string, payload: unknown) {
    const parsed = createFolderSchema.parse(payload);
    return prisma.secureFolder.create({
        data: {
            name: parsed.name,
            description: parsed.description,
            crisisId: parsed.crisisId || null,
            ownerId,
        },
    });
}

export async function getUserFolders(ownerId: string, includeDeleted = false) {
    return prisma.secureFolder.findMany({
        where: { ownerId, isDeleted: includeDeleted ? undefined : false },
        include: {
            _count: { select: { files: true, notes: true } },
            // Include crisis title
            shareLinks: {
                where: { isRevoked: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                select: { token: true, expiresAt: true }
            }
        },
        orderBy: [
            { isPinned: 'desc' },
            { updatedAt: 'desc' }
        ]
    });
}

export async function listActiveCrises() {
    return prisma.crisisEvent.findMany({
        where: {
            status: { in: ["ACTIVE", "CONTAINED"] }
        },
        select: {
            id: true,
            title: true,
            status: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

export async function getFolderDetails(ownerId: string, folderId: string) {
    const folder = await prisma.secureFolder.findFirst({
        where: { id: folderId, ownerId, isDeleted: false },
        include: {
            files: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
            notes: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
            shareLinks: {
                where: { isRevoked: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                orderBy: { createdAt: 'desc' },
                take: 1
            },
            // SRS requirement: Show Linked Crisis name if possible
            owner: { select: { id: true, fullName: true, email: true } }
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
    
    // Requirement: optional expiration time (1 hour, 24 hours, 7 days, or no expiry)
    // Revoke any previous non-revoked links first to keep it clean (one link per folder)
    await prisma.shareLink.updateMany({
        where: { folderId, isRevoked: false },
        data: { isRevoked: true }
    });

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

export async function getFolderByToken(token: string) {
    const link = await prisma.shareLink.findFirst({
        where: { token },
        include: {
            folder: {
                include: {
                    files: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
                    notes: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
                    owner: { select: { id: true, fullName: true, email: true } }
                }
            }
        }
    });

    if (!link) {
        console.error(`[SHARE_LINK] Link not found for token: ${token}`);
        throw new Error("Shared link not found");
    }

    if (link.isRevoked) {
        console.error(`[SHARE_LINK] Link revoked for token: ${token}`);
        throw new Error("Shared link has been revoked");
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
        console.error(`[SHARE_LINK] Link expired for token: ${token}. Expired at: ${link.expiresAt}`);
        throw new Error("Shared link has expired");
    }

    if (!link.folder || link.folder.isDeleted) {
        console.error(`[SHARE_LINK] Folder missing or deleted for token: ${token}`);
        throw new Error("The shared folder no longer exists");
    }

    return link.folder;
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

    // Requirement: maximum 20 files per folder
    const fileCount = await prisma.folderFile.count({
        where: { folderId, isDeleted: false }
    });
    if (fileCount >= 20) throw new Error("Maximum 20 files per folder reached");

    return prisma.folderFile.create({
        data: {
            folderId,
            uploaderId: ownerId,
            fileUrl: fileData.url,     // e.g., /uploads/171000-image.png
            fileType: fileData.mimeType,
            sizeBytes: fileData.fileSize,
            gpsLat: fileData.lat,
            gpsLng: fileData.lng,
            fileName: fileData.fileName,
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

export async function togglePinFolder(ownerId: string, folderId: string) {
    const folder = await prisma.secureFolder.findFirst({
        where: { id: folderId, ownerId }
    });
    if (!folder) throw new Error("Folder not found");

    return prisma.secureFolder.update({
        where: { id: folderId },
        data: { isPinned: !folder.isPinned }
    });
}

export async function restoreFolder(ownerId: string, folderId: string) {
    return prisma.secureFolder.update({
        where: { id: folderId, ownerId },
        data: { isDeleted: false, deletedAt: null }
    });
}

export async function restoreFile(uploaderId: string, fileId: string) {
    return prisma.folderFile.update({
        where: { id: fileId, uploaderId },
        data: { isDeleted: false, deletedAt: null }
    });
}

export async function restoreNote(authorId: string, noteId: string) {
    return prisma.folderNote.update({
        where: { id: noteId, authorId },
        data: { isDeleted: false, deletedAt: null }
    });
}

export async function updateFileDescription(uploaderId: string, fileId: string, description: string) {
    return prisma.folderFile.update({
        where: { id: fileId, uploaderId },
        data: { description }
    });
}