import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import type { NextFunction, Request, Response } from "express";

import {
  createIncidentReport,
  listIncidentReports,
  getIncidentReportById,
  getMapIncidentReports,
  listCrisisEventsForListView,
  processReportAsync
} from "../services/reportService.js";
import { getReportEvidenceSummary } from "../services/claimService.js";
import { redactCoordinates } from "../utils/geoRedact.js";
import {
  validateReportListQueryInput,
  validateReportSubmissionInput
} from "../utils/validation.js";
import { metrics } from "../utils/metrics.js";

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
  const requestStart = Date.now();
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

  const latitude = request.body.latitude ? parseFloat(request.body.latitude) : null;
  const longitude = request.body.longitude ? parseFloat(request.body.longitude) : null;
  const validLatitude = (latitude != null && Number.isFinite(latitude)) ? latitude : null;
  const validLongitude = (longitude != null && Number.isFinite(longitude)) ? longitude : null;

  let report;
  try {
    report = await createIncidentReport({
      reporterId,
      incidentTitle: payload.incidentTitle,
      description: payload.description,
      incidentType: payload.incidentType,
      locationText: payload.locationText,
      latitude: validLatitude,
      longitude: validLongitude,
      mediaFiles: storedMediaFiles,
      voiceFile: voiceFile
        ? {
            buffer: voiceFile.buffer,
            originalname: voiceFile.originalname,
            mimetype: voiceFile.mimetype,
            size: voiceFile.size
          }
        : undefined,
      aiConsent: String(request.body.aiConsent) === "true"
    });
  } catch (err) {
    // P1-2: Clean up orphaned uploads if report creation fails
    await Promise.allSettled(
      storedMediaFiles.map((f) => unlink(path.join(process.cwd(), f.originalname)).catch(() => {}))
    );
    throw err;
  }

  // FR-02: Return 202 Accepted — the report is persisted and queued for
  // AI classification, clustering, and notification dispatch asynchronously.
  const asyncContext = (report as any)._async;
  const { _async, ...clientReport } = report as any;

  // Fire-and-forget: AI classification, clustering, and notifications
  if (asyncContext) {
    processReportAsync(asyncContext.reportId, {
      description: asyncContext.description,
      trimmedTitle: asyncContext.trimmedTitle,
      trimmedLocation: asyncContext.trimmedLocation,
      userSelectedIncidentType: asyncContext.userSelectedIncidentType,
      input: asyncContext.input
    }).catch((err) => {
      console.error("[async] processReportAsync failed for report", asyncContext.reportId, err);
    });
  }

  // §15.4: Record report acknowledgement latency (request start → 202 response)
  metrics.recordReportAck(Date.now() - requestStart);

  return response.status(202).json({
    message: "Incident report accepted and queued for processing",
    report: clientReport
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
  const reportId = request.params.id as string;
  const viewerId = request.authUser?.userId;

  if (!viewerId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  if (!objectIdHexPattern.test(reportId)) {
    return response.status(400).json({ message: "Invalid report ID" });
  }

  try {
    const report = await getIncidentReportById(reportId, viewerId, request.authUser!.role);
    // Fetch the real evidence summary from the claims layer — this replaces
    // the opaque credibilityScore as the primary confidence signal in the UI.
    const evidenceSummary = await getReportEvidenceSummary(reportId);
    return response.status(200).json({ report, evidenceSummary });
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

export async function getMapReports(
  request: Request,
  response: Response
) {
  const viewerId = request.authUser?.userId;

  if (!viewerId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const reports = await getMapIncidentReports(viewerId);
  const viewerRole = request.authUser?.role;
  const isInternal = viewerRole === "ADMIN" || viewerRole === "VOLUNTEER";

  // FR-14: Public map view uses canonical IDs only; internal viewers see the DB id
  return response.status(200).json(
    reports.map((r) => {
      const coords = redactCoordinates(r.latitude, r.longitude, viewerRole);
      return {
        id: isInternal ? r.id : `event-${r.id.slice(-8)}`,
        canonicalId: (r as any).canonicalId ?? null,
        title: r.title,
        type: r.incidentType,
        severity: r.severityLevel,
        latitude: coords.latitude,
        longitude: coords.longitude,
        description: r.sitRepText || r.locationText,
        createdAt: r.createdAt
      };
    })
  );
}

/**
 * AC-05.04: Crisis event list view — same data source as the map,
 * providing an accessible list alternative to the map visualization.
 */
export async function listCrisisEvents(
  request: Request,
  response: Response
) {
  const viewerRole = request.authUser?.role;
  const { incidentType, severity, search } = request.query;

  const events = await listCrisisEventsForListView({
    incidentType: incidentType ? String(incidentType) : undefined,
    severity: severity ? String(severity) : undefined,
    search: search ? String(search) : undefined,
  });

  const isInternal = viewerRole === "ADMIN" || viewerRole === "VOLUNTEER";

  return response.status(200).json(
    events.map((e) => {
      const coords = redactCoordinates(e.latitude, e.longitude, viewerRole);
      return {
        id: isInternal ? e.id : `event-${e.id.slice(-8)}`,
        canonicalId: e.canonicalId,
        title: e.title,
        type: e.incidentType,
        severity: e.severityLevel,
        status: e.status,
        location: e.locationText,
        sitRep: e.sitRepText,
        latitude: coords.latitude,
        longitude: coords.longitude,
        reportCount: e.reportCount,
        reporterCount: e.reporterCount,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      };
    })
  );
}
