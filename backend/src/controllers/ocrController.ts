import type { Request, Response } from "express";
import * as ocrService from "../services/ocrService.js";
import { prisma } from "../lib/prisma.js";

export async function extractText(req: Request, res: Response) {
  const file = req.file;
  let fileId = req.body.fileId;
  let imageUrl = "";
  let imagePath = "";

  if (file) {
    imagePath = file.path;
    imageUrl = `/uploads/${file.filename}`;
  } else if (fileId) {
    const dbFile = await prisma.folderFile.findUnique({ where: { id: fileId } });
    if (!dbFile) return res.status(404).json({ message: "File not found" });
    imageUrl = dbFile.fileUrl;
    // For local dummy, we'd need absolute path. This is simulation.
    imagePath = imageUrl;
  } else {
    return res.status(400).json({ message: "No image provided" });
  }

  const result = await ocrService.performOCR(imagePath, imageUrl);
  res.json({ ...result, imageUrl });
}

export async function saveOCR(req: Request, res: Response) {
  const userId = req.authUser!.userId;
  const { fileId, fullText, annotations, imageUrl } = req.body;

  const result = await ocrService.saveOCRResult(userId, {
    fileId,
    fullText,
    annotations,
    imageUrl
  });

  res.status(201).json(result);
}

export async function getHistory(req: Request, res: Response) {
  const userId = req.authUser!.userId;
  const history = await ocrService.getOCRHistory(userId);
  res.json(history);
}

export async function getOCRByFile(req: Request, res: Response) {
  const { fileId } = req.params;
  const result = await ocrService.getOCRByFileId(fileId);
  if (!result) return res.status(404).json({ message: "No OCR result for this file" });
  res.json(result);
}

export async function updateOCR(req: Request, res: Response) {
  const userId = req.authUser!.userId;
  const { ocrId } = req.params;
  const { fullText, annotations } = req.body;

  const result = await ocrService.updateOCRText(ocrId, userId, fullText, annotations);
  res.json(result);
}
