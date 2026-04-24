import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;

type OCRBox = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type OCRResultItem = {
  text: string;
  confidence: number | null;
  category: string;
  box: OCRBox;
};

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

type OCRSpaceWord = {
  WordText?: string;
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
  WordConfidence?: number;
};

type OCRSpaceLine = {
  Words?: OCRSpaceWord[];
  LineText?: string;
  MinTop?: number;
  MaxHeight?: number;
};

type OCRSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: {
    ParsedText?: string;
    TextOverlay?: {
      Lines?: OCRSpaceLine[];
    };
  }[];
};

export function validateOcrImage(file: Express.Multer.File) {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new Error("OCR supports JPG, PNG, and WEBP images only");
  }

  if (file.size > MAX_OCR_IMAGE_BYTES) {
    throw new Error("OCR image must be 10MB or less");
  }
}

export async function scanUploadedImage(
  userId: string,
  file: Express.Multer.File,
  links: {
    folderId?: string | null;
    crisisEventId?: string | null;
    incidentReportId?: string | null;
  }
) {
  validateOcrImage(file);

  if (links.folderId) {
    await assertFolderOwner(userId, links.folderId);
  }

  const imageUrl = await persistOcrUpload(file);
  return createScan(userId, {
    buffer: file.buffer,
    mimeType: file.mimetype,
    fileName: file.originalname,
    imageUrl,
    folderId: links.folderId,
    crisisEventId: links.crisisEventId,
    incidentReportId: links.incidentReportId
  });
}

export async function scanFolderFile(
  userId: string,
  folderId: string,
  fileId: string,
  links: {
    crisisEventId?: string | null;
    incidentReportId?: string | null;
  }
) {
  const folder = await prisma.secureFolder.findFirst({
    where: { id: folderId, ownerId: userId, isDeleted: false },
    include: {
      files: {
        where: { id: fileId, isDeleted: false },
        take: 1
      }
    }
  });

  const file = folder?.files[0];
  if (!folder || !file) {
    throw new Error("File not found or access denied");
  }

  if (!IMAGE_MIME_TYPES.has(file.fileType)) {
    throw new Error("Only image files can be scanned with OCR");
  }

  if (file.sizeBytes > MAX_OCR_IMAGE_BYTES) {
    throw new Error("OCR image must be 10MB or less");
  }

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
        items: { orderBy: { createdAt: "asc" } },
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
      items: { orderBy: { createdAt: "asc" } },
      folder: { select: { id: true, name: true } },
      crisisEvent: { select: { id: true, title: true } },
      incidentReport: { select: { id: true, incidentTitle: true } }
    }
  });

  if (!scan) {
    throw new Error("OCR scan not found");
  }

  return scan;
}

export async function updateScanItem(
  userId: string,
  scanId: string,
  itemId: string,
  text: string,
  category?: string
) {
  await getUserScan(userId, scanId);
  const item = await prisma.oCRItem.findFirst({
    where: { id: itemId, scanId },
    select: { id: true }
  });

  if (!item) {
    throw new Error("OCR item not found");
  }

  return prisma.oCRItem.update({
    where: { id: item.id },
    data: {
      text: text.trim(),
      category: category?.trim() || inferTextCategory(text)
    }
  });
}

export async function attachScan(
  userId: string,
  scanId: string,
  links: {
    folderId?: string | null;
    crisisEventId?: string | null;
    incidentReportId?: string | null;
  }
) {
  await getUserScan(userId, scanId);

  if (links.folderId) {
    await assertFolderOwner(userId, links.folderId);
  }

  return prisma.oCRScan.update({
    where: { id: scanId },
    data: {
      folderId: links.folderId,
      crisisEventId: links.crisisEventId,
      incidentReportId: links.incidentReportId
    },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      folder: { select: { id: true, name: true } },
      crisisEvent: { select: { id: true, title: true } },
      incidentReport: { select: { id: true, incidentTitle: true } }
    }
  });
}

async function createScan(userId: string, source: ScanSource) {
  const result = await extractText(source);
  const items = result.items.length > 0
    ? result.items
    : splitTextIntoItems(result.rawText);

  return prisma.oCRScan.create({
    data: {
      userId,
      folderId: source.folderId || null,
      fileId: source.fileId || null,
      crisisEventId: source.crisisEventId || null,
      incidentReportId: source.incidentReportId || null,
      sourceImageUrl: source.imageUrl,
      sourceFileName: source.fileName,
      provider: result.provider,
      rawText: result.rawText,
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

async function extractText(source: ScanSource) {
  if (env.ocrProvider === "mock" || !env.ocrSpaceApiKey) {
    const text = "CORE OCR demo result. Add OCR_SPACE_API_KEY to scan live images.";
    return {
      provider: "mock",
      rawText: text,
      items: splitTextIntoItems(text)
    };
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
    form.append(
      "file",
      new Blob([new Uint8Array(source.buffer)], { type: source.mimeType }),
      source.fileName
    );

    const response = await fetch(env.ocrSpaceEndpoint, {
      method: "POST",
      body: form,
      signal: controller.signal
    });

    const payload = (await response.json()) as OCRSpaceResponse;
    if (!response.ok || payload.IsErroredOnProcessing) {
      const message = Array.isArray(payload.ErrorMessage)
        ? payload.ErrorMessage.join(" ")
        : payload.ErrorMessage;
      throw new Error(message || "OCR provider failed to process the image");
    }

    return {
      provider: "ocrspace",
      rawText: payload.ParsedResults?.map((result) => result.ParsedText ?? "").join("\n").trim() ?? "",
      items: parseOcrSpaceItems(payload)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseOcrSpaceItems(payload: OCRSpaceResponse): OCRResultItem[] {
  return payload.ParsedResults?.flatMap((result) =>
    result.TextOverlay?.Lines?.flatMap((line) =>
      line.Words?.map((word) => {
        const text = word.WordText?.trim() ?? "";
        return {
          text,
          confidence: word.WordConfidence ?? null,
          category: inferTextCategory(text),
          box: {
            left: word.Left,
            top: word.Top,
            width: word.Width,
            height: word.Height
          }
        };
      }).filter((item) => item.text.length > 0) ?? []
    ) ?? []
  ) ?? [];
}

function splitTextIntoItems(rawText: string): OCRResultItem[] {
  return rawText
    .split(/\r?\n| {2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      confidence: null,
      category: inferTextCategory(text),
      box: {}
    }));
}

function inferTextCategory(text: string) {
  const normalized = text.trim();

  if (/^[A-Z]{1,3}[-\s]?\d{2,4}[-\s]?[A-Z]{0,3}$/i.test(normalized)) {
    return "License Plate";
  }

  if (/\b(road|street|st\.|avenue|ave|house|holding|block|sector|lane)\b/i.test(normalized)) {
    return "Street Address";
  }

  if (/\b(danger|warning|caution|hazard|flammable|restricted|evacuate)\b/i.test(normalized)) {
    return "Warning Label";
  }

  if (normalized.length <= 40 && /^[A-Z0-9\s.,:/-]+$/.test(normalized)) {
    return "Sign";
  }

  return "General Text";
}

async function persistOcrUpload(file: Express.Multer.File) {
  const uploadDirectory = path.resolve(process.cwd(), "uploads", "ocr");
  await mkdir(uploadDirectory, { recursive: true });

  const extension = path.extname(file.originalname) || extensionFromMime(file.mimetype);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDirectory, filename), file.buffer);

  return `/uploads/ocr/${filename}`;
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return "";
}

function resolveUploadPath(fileUrl: string) {
  const relative = fileUrl.replace(/^\/+/, "");
  const resolved = path.resolve(process.cwd(), relative);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  if (!resolved.startsWith(uploadsRoot)) {
    throw new Error("Invalid file path");
  }

  return resolved;
}

async function assertFolderOwner(userId: string, folderId: string) {
  const folder = await prisma.secureFolder.findFirst({
    where: { id: folderId, ownerId: userId, isDeleted: false },
    select: { id: true }
  });

  if (!folder) {
    throw new Error("Folder not found or access denied");
  }
}
