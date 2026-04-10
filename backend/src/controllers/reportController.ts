import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NextFunction, Request, Response } from "express";

import {
  createIncidentReport,
  listIncidentReports,
  getIncidentReportById
} from "../services/reportService.js";
import {
  validateReportListQueryInput,
  validateReportSubmissionInput
} from "../utils/validation.js";

const objectIdHexPattern = /^[a-fA-F0-9]{24}$/;

function mapFiles(request: Request) {
  const filesByField = request.files as Record<string, Express.Multer.File[]> | undefined;
  const mediaFiles = filesByField?.media ?? [];
  const voiceFile = filesByField?.voiceNote?.[0];

  return { mediaFiles, voiceFile };
}

function inferFileExtension(file: Express.Multer.File) {
  const nameExtension = path.extname(file.originalname).toLowerCase();
  if (nameExtension && nameExtension.length <= 10) {
    return nameExtension;
  }

  if (file.mimetype.startsWith("image/")) {
    return `.${file.mimetype.slice("image/".length)}`;
  }

  if (file.mimetype.startsWith("video/")) {
    return `.${file.mimetype.slice("video/".length)}`;
  }

  return "";
}

async function persistMediaFiles(files: Express.Multer.File[]) {
  if (files.length === 0) {
    return [];
  }

  const uploadDirectory = path.resolve(process.cwd(), "uploads", "reports");
  await mkdir(uploadDirectory, { recursive: true });

  return Promise.all(
    files.map(async (file) => {
      const extension = inferFileExtension(file);
      const filename = `${Date.now()}-${randomUUID()}${extension}`;
      const targetPath = path.join(uploadDirectory, filename);
      await writeFile(targetPath, file.buffer);

      return {
        originalname: `/uploads/reports/${filename}`,
        mimetype: file.mimetype,
        size: file.size
      };
    })
  );
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
  const storedMediaFiles = await persistMediaFiles(mediaFiles);

  const report = await createIncidentReport({
    reporterId,
    incidentTitle: payload.incidentTitle,
    description: payload.description,
    incidentType: payload.incidentType,
    locationText: payload.locationText,
    latitude: request.body.latitude ? parseFloat(request.body.latitude) : null,
    longitude: request.body.longitude ? parseFloat(request.body.longitude) : null,
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
    order: query.order,
    page: query.page,
    limit: query.limit
  });

  return response.status(200).json({ reports });
}

export async function getReportDetail(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reportId = request.params.id;
  const viewerId = request.authUser?.userId;

  if (!viewerId) {
    return response.status(401).json({ message: "Authentication required" });
  }

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
    order: query.order,
    page: query.page,
    limit: query.limit
  });

  return response.status(200).json({ reports });
}

import { getMapIncidentReports } from "../services/reportService.js";

export async function getMapReports(
  request: Request,
  response: Response
) {
  const viewerId = request.authUser?.userId;

  if (!viewerId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const reports = await getMapIncidentReports(viewerId);

  return response.status(200).json(
    reports.map((r) => ({
      id: r.id,
      title: r.classifiedIncidentTitle || r.incidentTitle,
      type: r.classifiedIncidentType || r.incidentType,
      severity: r.severityLevel,
      latitude: r.latitude,
      longitude: r.longitude,
      description: r.description,
      createdAt: r.createdAt
    }))
  );
}