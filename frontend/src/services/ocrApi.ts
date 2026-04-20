import {api} from "./api";

export interface OCRAnnotation {
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  category?: "License Plate" | "Street Address" | "Warning Label" | "Sign" | "General Text";
}

export interface OCRResult {
  id: string;
  userId: string;
  fileId?: string;
  fullText: string;
  annotations: OCRAnnotation[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  FolderFile?: any[];
}

export const ocrApi = {
  extractText: async (image?: File, fileId?: string): Promise<{ fullText: string; annotations: OCRAnnotation[]; imageUrl: string }> => {
    const formData = new FormData();
    if (image) formData.append("image", image);
    if (fileId) formData.append("fileId", fileId);
    
    const response = await api.post("/ocr/extract", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },

  saveOCR: async (data: {
    fileId?: string;
    fullText: string;
    annotations: OCRAnnotation[];
    imageUrl: string;
  }): Promise<OCRResult> => {
    const response = await api.post("/ocr/save", data);
    return response.data;
  },

  getHistory: async (): Promise<OCRResult[]> => {
    const response = await api.get("/ocr/history");
    return response.data;
  },

  getOCRByFile: async (fileId: string): Promise<OCRResult> => {
    const response = await api.get(`/ocr/file/${fileId}`);
    return response.data;
  },

  updateOCR: async (ocrId: string, data: { fullText: string; annotations: OCRAnnotation[] }): Promise<OCRResult> => {
    const response = await api.patch(`/ocr/${ocrId}`, data);
    return response.data;
  }
};
