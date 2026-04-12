import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NextFunction, Request, Response } from "express";

import {
  createIncidentReport,
  listIncidentReports,
  getIncidentReportById,
  getMapIncidentReports
} from "../services/reportService.js";
import {
  validateReportListQueryInput,
  validateReportSubmissionInput
} from "../utils/validation.js";
import { objectIdHexPattern } from "../utils/incidentMapping.js";

const UPLOADS_SUBDIR = path.join("uploads", "reports");
const MAX_EXTENSION_LENGTH = 10;

function parseCoordinate(raw: unknown, min: number, max: number): number | null {
  if (raw == null || raw === "") return null;
  const parsed = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function extractFiles(request: Request) {
  const filesByField = request.files as Record<string, Express.Multer.File[]> | undefined;
  return {
    mediaFiles: filesByField?.media ?? [],
    voiceFile: filesByField?.voiceNote?.[0]
  };
}

function inferFileExtension(file: Express.Multer.File) {
  const nameExtension = path.extname(file.originalname).toLowerCase();
  if (nameExtension && nameExtension.length <= MAX_EXTENSION_LENGTH) {
    return nameExtension;
  }
  const [category, subtype] = file.mimetype.split("/");
  if ((category === "image" || category === "video") && subtype) {
    return `.${subtype}`;
  }
  return "";
}

async function persistMediaFiles(files: Express.Multer.File[]) {
  if (files.length === 0) {
    return [];
  }

  const uploadDirectory = path.resolve(process.cwd(), UPLOADS_SUBDIR);
  await mkdir(uploadDirectory, { recursive: true });

  return Promise.all(
    files.map(async (file) => {
      const filename = `${Date.now()}-${randomUUID()}${inferFileExtension(file)}`;
      await writeFile(path.join(uploadDirectory, filename), file.buffer);
      return {
        originalname: `/${UPLOADS_SUBDIR.replace(/\\/g, "/")}/${filename}`,
        mimetype: file.mimetype,
        size: file.size
      };
    })
  );
}

function fileMeta(file: Express.Multer.File) {
  return {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  };
}

function requireUserId(request: Request, response: Response): string | null {
  const userId = request.authUser?.userId;
  if (!userId) {
    response.status(401).json({ message: "Authentication required" });
    return null;
  }
  return userId;
}

export async function createReport(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reporterId = requireUserId(request, response);
  if (!reporterId) return;

  const { mediaFiles, voiceFile } = extractFiles(request);

  const payload = validateReportSubmissionInput({
    incidentTitle: String(request.body.incidentTitle ?? ""),
    description: String(request.body.description ?? ""),
    incidentType: String(request.body.incidentType ?? ""),
    locationText: String(request.body.locationText ?? ""),
    mediaFiles: mediaFiles.map(fileMeta),
    voiceFile: voiceFile ? fileMeta(voiceFile) : undefined
  });

  const storedMediaFiles = await persistMediaFiles(mediaFiles);

  const report = await createIncidentReport({
    reporterId,
    incidentTitle: payload.incidentTitle,
    description: payload.description,
    incidentType: payload.incidentType,
    locationText: payload.locationText,
    latitude: parseCoordinate(request.body.latitude, -90, 90),
    longitude: parseCoordinate(request.body.longitude, -180, 180),
    mediaFiles: storedMediaFiles,
    voiceFile: voiceFile
      ? {
          buffer: voiceFile.buffer,
          originalname: voiceFile.originalname,
          mimetype: voiceFile.mimetype,
          size: voiceFile.size
        }
      : undefined
  });

  return response.status(201).json({
    message: "Incident report submitted successfully",
    report
  });
}

export async function listMyReports(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reporterId = requireUserId(request, response);
  if (!reporterId) return;

  const query = validateReportListQueryInput(request.query);
  const reports = await listIncidentReports({ ...query, viewerId: reporterId, scope: "mine" });

  return response.status(200).json({ reports });
}

export async function listReports(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reporterId = requireUserId(request, response);
  if (!reporterId) return;

  const query = validateReportListQueryInput(request.query);
  const reports = await listIncidentReports({ ...query, viewerId: reporterId, scope: "community" });

  return response.status(200).json({ reports });
}

export async function getReportDetail(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const viewerId = requireUserId(request, response);
  if (!viewerId) return;

  const reportId = String(request.params.id);
  if (!objectIdHexPattern.test(reportId)) {
    return response.status(400).json({ message: "Invalid report ID" });
  }

  try {
    const report = await getIncidentReportById(reportId, viewerId);
    return response.status(200).json({ report });
  } catch {
    return response.status(404).json({ message: "Report not found" });
  }
}

export async function getMapReports(request: Request, response: Response) {
  const viewerId = requireUserId(request, response);
  if (!viewerId) return;

  const reports = await getMapIncidentReports(viewerId);

  return response.status(200).json(
    reports.map((report) => ({
      id: report.id,
      title: report.classifiedIncidentTitle || report.incidentTitle,
      type: report.classifiedIncidentType || report.incidentType,
      severity: report.severityLevel,
      latitude: report.latitude,
      longitude: report.longitude,
      description: report.description,
      createdAt: report.createdAt
    }))
  );
}
