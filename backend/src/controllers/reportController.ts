import type { NextFunction, Request, Response } from "express";

import {
  createIncidentReport,
  listIncidentReports
} from "../services/reportService.js";
import {
  validateReportListQueryInput,
  validateReportSubmissionInput
} from "../utils/validation.js";

function mapFiles(request: Request) {
  const filesByField = request.files as Record<string, Express.Multer.File[]> | undefined;
  const mediaFiles = filesByField?.media ?? [];
  const voiceFile = filesByField?.voiceNote?.[0];

  return { mediaFiles, voiceFile };
}

export async function createReport(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reporterId = request.authUser?.userId;
  if (!reporterId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const { mediaFiles, voiceFile } = mapFiles(request);
  const payload = validateReportSubmissionInput({
    incidentTitle: String(request.body.incidentTitle ?? ""),
    description: String(request.body.description ?? ""),
    incidentType: String(request.body.incidentType ?? ""),
    locationText: String(request.body.locationText ?? ""),
    mediaFiles: mediaFiles.map((file) => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    })),
    voiceFile: voiceFile
      ? {
          originalname: voiceFile.originalname,
          mimetype: voiceFile.mimetype,
          size: voiceFile.size
        }
      : undefined
  });

  const report = await createIncidentReport({
    reporterId,
    incidentTitle: payload.incidentTitle,
    description: payload.description,
    incidentType: payload.incidentType,
    locationText: payload.locationText,
    mediaFiles: payload.mediaFiles,
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
  const reporterId = request.authUser?.userId;
  if (!reporterId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const query = validateReportListQueryInput(request.query);
  const reports = await listIncidentReports({
    viewerId: reporterId,
    scope: "mine",
    search: query.search,
    severity: query.severity,
    sortBy: query.sortBy,
    order: query.order
  });

  return response.status(200).json({ reports });
}

export async function listReports(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reporterId = request.authUser?.userId;
  if (!reporterId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const query = validateReportListQueryInput(request.query);
  const reports = await listIncidentReports({
    viewerId: reporterId,
    scope: "community",
    search: query.search,
    severity: query.severity,
    sortBy: query.sortBy,
    order: query.order
  });

  return response.status(200).json({ reports });
}
