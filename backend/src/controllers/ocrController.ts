import type { Request, Response } from "express";
import * as ocrService from "../services/ocrService.js";

function requireUserId(request: Request, response: Response) {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function scanUpload(request: Request, response: Response) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const file = request.file;
  if (!file) {
    return response.status(400).json({ message: "Image file is required" });
  }

  // FR-10: Require explicit AI consent before sending images to third-party OCR/AI providers
  const aiConsent = request.body.aiConsent === true || request.body.aiConsent === "true";
  if (!aiConsent) {
    return response.status(403).json({
      message: "AI processing consent is required to run OCR on uploaded images."
    });
  }

  const scan = await ocrService.scanUploadedImage(userId, file, {
    folderId: optionalString(request.body.folderId),
    crisisEventId: optionalString(request.body.crisisEventId),
    incidentReportId: optionalString(request.body.incidentReportId)
  });

  return response.status(201).json({ scan });
}

export async function scanExistingFolderFile(request: Request, response: Response) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  // FR-10: Check aiConsent on the existing file before running OCR
  const { prisma } = await import("../lib/prisma.js");
  const folderFile = await prisma.folderFile.findUnique({
    where: { id: request.params.fileId as string },
    select: { aiConsent: true, uploaderId: true }
  });

  if (!folderFile) {
    return response.status(404).json({ message: "File not found" });
  }

  // Uploader can always scan their own files; others need aiConsent to be true
  const isOwner = folderFile.uploaderId === userId;
  if (!isOwner && !folderFile.aiConsent) {
    return response.status(403).json({
      message: "AI processing consent was not granted for this file."
    });
  }

  const scan = await ocrService.scanFolderFile(
      userId,
      request.params.folderId as string,
      request.params.fileId as string,
      {
        crisisEventId: optionalString(request.body.crisisEventId),
        incidentReportId: optionalString(request.body.incidentReportId)
      }
  );

  return response.status(201).json({ scan });
}

export async function listHistory(request: Request, response: Response) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20));
  const result = await ocrService.listUserScans(userId, page, limit);

  return response.status(200).json(result);
}

export async function getScan(request: Request, response: Response) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const scan = await ocrService.getUserScan(userId, request.params.scanId as string);
  return response.status(200).json({ scan });
}

export async function updateItem(request: Request, response: Response) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const text = typeof request.body.text === "string" ? request.body.text.trim() : "";
  if (!text) {
    return response.status(400).json({ message: "OCR text is required" });
  }

  const item = await ocrService.updateScanItem(
      userId,
      request.params.scanId as string,
      request.params.itemId as string,
      text,
      optionalString(request.body.category) ?? undefined
  );

  return response.status(200).json({ item });
}

export async function attachScan(request: Request, response: Response) {
  const userId = requireUserId(request, response);
  if (!userId) return;

  const scan = await ocrService.attachScan(userId, request.params.scanId as string, {
    folderId: optionalString(request.body.folderId),
    crisisEventId: optionalString(request.body.crisisEventId),
    incidentReportId: optionalString(request.body.incidentReportId)
  });

  return response.status(200).json({ scan });
}