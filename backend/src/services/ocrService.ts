import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;

// --- Types ---
type OCRBox = { left?: number; top?: number; width?: number; height?: number; };
type OCRResultItem = { text: string; confidence: number | null; category: string; box: OCRBox; };
type ScanSource = {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    imageUrl: string;
    folderId?: string | null;
    fileId?: string | null;
    crisisEventId?: string | null;
    incidentReportId?: string | null;
};

// --- Core AI & OCR Logic ---

async function describeDisaster(buffer: Buffer, mimeType: string): Promise<string> {
    if (!env.groqApiKey || env.groqApiKey === "test-key") {
        return "AI description skipped: no AI API key configured.";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
        const base64Image = buffer.toString("base64");
        const dataUri = `data:${mimeType};base64,${base64Image}`;

        const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.groqApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: env.groqVisionModel,
                temperature: 0.2,
                max_tokens: 16000,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this image of a potential natural disaster or incident. 1) Identify the disaster type (Flood, Fire, Earthquake, Building Collapse, etc.). 2) Describe the severity and visible damage. 3) Identify any immediate dangers or needed assistance. Provide a concise, professional summary for emergency responders."
                            },
                            { type: "image_url", image_url: { url: dataUri } }
                        ]
                    }
                ]
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            return `AI description unavailable (Groq status ${response.status}).`;
        }

        const payload = await response.json() as {
            choices: Array<{ message: { content: string } }>
        };

        return payload.choices[0]?.message?.content?.trim() || "No description generated.";
    } catch (error) {
        console.error("Groq vision error:", error);
        return "Failed to generate AI scenario description.";
    } finally {
        clearTimeout(timeout);
    }
}

async function extractText(source: ScanSource) {
    if (env.ocrProvider === "mock" || !env.ocrSpaceApiKey) {
        throw new Error("OCR provider not configured. Set OCR_SPACE_API_KEY in backend/.env to enable text extraction.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ocrRequestTimeoutMs);

    try {
        const form = new FormData();
        form.append("apikey", env.ocrSpaceApiKey);
        form.append("language", "auto");
        form.append("OCREngine", "2");
        form.append("isOverlayRequired", "true");
        form.append("scale", "true");
        const base64Image = `data:${source.mimeType};base64,${source.buffer.toString("base64")}`;
        form.append("base64Image", base64Image);        const response = await fetch(env.ocrSpaceEndpoint, {
            method: "POST",
            body: form,
            signal: controller.signal
        });

        const payload = await response.json() as any;

        // ADD THIS LINE TO DEBUG:
        // console.log("OCR.SPACE RESPONSE:", JSON.stringify(payload, null, 2));

        if (!response.ok || payload.IsErroredOnProcessing) {
            const message = Array.isArray(payload.ErrorMessage) ? payload.ErrorMessage.join(" ") : payload.ErrorMessage;
            throw new Error(message || "OCR provider failed to process the image");
        }

        return {
            provider: "ocrspace",
            rawText: payload.ParsedResults?.map((r: any) => r.ParsedText ?? "").join("\n").trim() ?? "",
            items: parseOcrSpaceItems(payload)
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function createScan(userId: string, source: ScanSource) {
    // Run OCR and AI Analysis in parallel for maximum speed
    const [ocrResult, aiDescription] = await Promise.all([
        extractText(source),
        describeDisaster(source.buffer, source.mimeType)
    ]);

    const items = ocrResult.items.length > 0 ? ocrResult.items : splitTextIntoItems(ocrResult.rawText);
    const combinedText = `--- AI SCENARIO SUMMARY ---\n${aiDescription}\n\n--- RAW EXTRACTED TEXT ---\n${ocrResult.rawText}`;

    return prisma.oCRScan.create({
        data: {
            userId,
            folderId: source.folderId || null,
            fileId: source.fileId || null,
            crisisEventId: source.crisisEventId || null,
            incidentReportId: source.incidentReportId || null,
            sourceImageUrl: source.imageUrl,
            sourceFileName: source.fileName,
            provider: ocrResult.provider,
            rawText: combinedText,
            items: {
                create: items.map((item) => ({
                    text: item.text,
                    confidence: item.confidence,
                    category: item.category,
                    bboxLeft: item.box.left,
                    bboxTop: item.box.top,
                    bboxWidth: item.box.width,
                    bboxHeight: item.box.height
                }))
            }
        },
        include: {
            items: { orderBy: { createdAt: "asc" } },
            folder: { select: { id: true, name: true } },
            crisisEvent: { select: { id: true, title: true } },
            incidentReport: { select: { id: true, incidentTitle: true } }
        }
    });
}

// --- Exported Controller Services ---

export function validateOcrImage(file: Express.Multer.File) {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) throw new Error("OCR supports JPG, PNG, and WEBP images only");
    if (file.size > MAX_OCR_IMAGE_BYTES) throw new Error("OCR image must be 10MB or less");
}

export async function scanUploadedImage(userId: string, file: Express.Multer.File, links: any) {
    validateOcrImage(file);
    if (links.folderId) await assertFolderOwner(userId, links.folderId);

    const imageUrl = await persistOcrUpload(file);
    return createScan(userId, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        fileName: file.originalname,
        imageUrl,
        ...links
    });
}

export async function scanFolderFile(userId: string, folderId: string, fileId: string, links: any) {
    const folder = await prisma.secureFolder.findFirst({
        where: { id: folderId, ownerId: userId, isDeleted: false },
        include: { files: { where: { id: fileId, isDeleted: false }, take: 1 } }
    });

    const file = folder?.files[0];
    if (!folder || !file) throw new Error("File not found or access denied");
    if (!IMAGE_MIME_TYPES.has(file.fileType)) throw new Error("Only image files can be scanned with OCR");
    if (file.sizeBytes > MAX_OCR_IMAGE_BYTES) throw new Error("OCR image must be 10MB or less");

    const buffer = await readFile(resolveUploadPath(file.fileUrl));

    return createScan(userId, {
        buffer,
        mimeType: file.fileType,
        fileName: file.fileName,
        imageUrl: file.fileUrl,
        folderId,
        fileId,
        crisisEventId: links.crisisEventId ?? folder.crisisId,
        incidentReportId: links.incidentReportId
    });
}

export async function listUserScans(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const [scans, total] = await Promise.all([
        prisma.oCRScan.findMany({
            where: { userId },
            include: {
                items: { orderBy: { createdAt: "asc" }, take: 100 },
                folder: { select: { id: true, name: true } },
                crisisEvent: { select: { id: true, title: true } },
                incidentReport: { select: { id: true, incidentTitle: true } }
            },
            orderBy: { createdAt: "desc" },
            skip: (safePage - 1) * safeLimit,
            take: safeLimit
        }),
        prisma.oCRScan.count({ where: { userId } })
    ]);

    return { scans, total, page: safePage, limit: safeLimit };
}

export async function getUserScan(userId: string, scanId: string) {
    const scan = await prisma.oCRScan.findFirst({
        where: { id: scanId, userId },
        include: {
            items: { orderBy: { createdAt: "asc" }, take: 100 },
            folder: { select: { id: true, name: true } },
            crisisEvent: { select: { id: true, title: true } },
            incidentReport: { select: { id: true, incidentTitle: true } }
        }
    });

    if (!scan) throw new Error("OCR scan not found");
    return scan;
}

export async function updateScanItem(userId: string, scanId: string, itemId: string, text: string, category?: string) {
    await getUserScan(userId, scanId);
    const item = await prisma.oCRItem.findFirst({ where: { id: itemId, scanId }, select: { id: true } });
    if (!item) throw new Error("OCR item not found");

    return prisma.oCRItem.update({
        where: { id: item.id },
        data: { text: text.trim(), category: category?.trim() || inferTextCategory(text) }
    });
}

export async function attachScan(userId: string, scanId: string, links: any) {
    await getUserScan(userId, scanId);
    if (links.folderId) await assertFolderOwner(userId, links.folderId);

    return prisma.oCRScan.update({
        where: { id: scanId },
        data: {
            folderId: links.folderId,
            crisisEventId: links.crisisEventId,
            incidentReportId: links.incidentReportId
        },
        include: {
            items: { orderBy: { createdAt: "asc" }, take: 100 },
            folder: { select: { id: true, name: true } },
            crisisEvent: { select: { id: true, title: true } },
            incidentReport: { select: { id: true, incidentTitle: true } }
        }
    });
}

// --- Helper Functions ---

async function persistOcrUpload(file: Express.Multer.File) {
    const uploadDirectory = path.resolve(process.cwd(), "uploads", "ocr");
    await mkdir(uploadDirectory, { recursive: true });

    const extension = path.extname(file.originalname) || extensionFromMime(file.mimetype);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(path.join(uploadDirectory, filename), file.buffer);

    return `/uploads/ocr/${filename}`;
}

function parseOcrSpaceItems(payload: any): OCRResultItem[] {
    return payload.ParsedResults?.flatMap((result: any) =>
        result.TextOverlay?.Lines?.flatMap((line: any) =>
            line.Words?.map((word: any) => {
                const text = word.WordText?.trim() ?? "";
                return {
                    text,
                    confidence: word.WordConfidence ?? null,
                    category: inferTextCategory(text),
                    box: { left: word.Left, top: word.Top, width: word.Width, height: word.Height }
                };
            }).filter((item: any) => item.text.length > 0) ?? []
        ) ?? []
    ) ?? [];
}

function splitTextIntoItems(rawText: string): OCRResultItem[] {
    return rawText.split(/\r?\n| {2,}/).map((t) => t.trim()).filter(Boolean).map((text) => ({
        text, confidence: null, category: inferTextCategory(text), box: {}
    }));
}

function inferTextCategory(text: string) {
    const normalized = text.trim();
    if (/^[A-Z]{1,3}[-\s]?\d{2,4}[-\s]?[A-Z]{0,3}$/i.test(normalized)) return "License Plate";
    if (/\b(road|street|st\.|avenue|ave|house|holding|block|sector|lane)\b/i.test(normalized)) return "Street Address";
    if (/\b(danger|warning|caution|hazard|flammable|restricted|evacuate)\b/i.test(normalized)) return "Warning Label";
    if (normalized.length <= 40 && /^[A-Z0-9\s.,:/-]+$/.test(normalized)) return "Sign";
    return "General Text";
}

function extensionFromMime(mimeType: string) {
    if (mimeType === "image/jpeg") return ".jpg";
    if (mimeType === "image/png") return ".png";
    if (mimeType === "image/webp") return ".webp";
    return "";
}

function resolveUploadPath(fileUrl: string) {
    const relative = fileUrl.replace(/^\/+/, "");
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const resolved = path.resolve(uploadsRoot, relative);
    // Ensure the resolved path is inside uploadsRoot (prevent path traversal).
    // Use path.relative to check containment robustly (avoidsstartsWith bypass
    // e.g. uploads-evil sibling directories).
    const relativeToRoot = path.relative(uploadsRoot, resolved);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        throw new Error("Invalid file path");
    }
    return resolved;
}

async function assertFolderOwner(userId: string, folderId: string) {
    const folder = await prisma.secureFolder.findFirst({
        where: { id: folderId, ownerId: userId, isDeleted: false },
        select: { id: true }
    });
    if (!folder) throw new Error("Folder not found or access denied");
}