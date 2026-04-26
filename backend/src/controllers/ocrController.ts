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

  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);
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