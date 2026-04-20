import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export type OCRAnnotation = {
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  category?: "License Plate" | "Street Address" | "Warning Label" | "Sign" | "General Text";
};

export async function performOCR(imagePath: string, imageUrl?: string): Promise<{ fullText: string; annotations: OCRAnnotation[] }> {
  // In a real scenario, we would use @google-cloud/vision
  // For this task, we'll simulate the Google Vision OCR API response
  // as per "here is a dummy ocr api GOOGLE_APPLICATION_CREDENTIALS..." instruction
  
  console.log(`[OCR] Processing image: ${imagePath}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Dummy logic to return some "detected" text based on the image name or just random
  const dummyResults: OCRAnnotation[] = [
    {
      text: "DHAKA-METRO-GA-12-3456",
      confidence: 0.98,
      boundingBox: { x: 100, y: 200, width: 150, height: 40 },
      category: "License Plate"
    },
    {
      text: "DANGER: HIGH VOLTAGE",
      confidence: 0.95,
      boundingBox: { x: 300, y: 50, width: 200, height: 50 },
      category: "Warning Label"
    },
    {
      text: "HOUSE 12, ROAD 5, DHANMONDI",
      confidence: 0.92,
      boundingBox: { x: 50, y: 400, width: 300, height: 30 },
      category: "Street Address"
    }
  ];

  const fullText = dummyResults.map(a => a.text).join("\n");

  return {
    fullText,
    annotations: dummyResults
  };
}

export async function saveOCRResult(userId: string, data: {
  fileId?: string;
  fullText: string;
  annotations: any;
  imageUrl?: string;
}) {
  return prisma.oCRResult.create({
    data: {
      userId,
      fileId: data.fileId,
      fullText: data.fullText,
      annotations: data.annotations,
      imageUrl: data.imageUrl
    }
  });
}

export async function getOCRHistory(userId: string) {
  return prisma.oCRResult.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      FolderFile: {
        select: {
          id: true,
          fileName: true,
          fileUrl: true
        }
      }
    }
  });
}

export async function getOCRByFileId(fileId: string) {
  return prisma.oCRResult.findUnique({
    where: { fileId }
  });
}

export async function updateOCRText(ocrId: string, userId: string, fullText: string, annotations: any) {
  return prisma.oCRResult.update({
    where: { id: ocrId, userId },
    data: { fullText, annotations }
  });
}
