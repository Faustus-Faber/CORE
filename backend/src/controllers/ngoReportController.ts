import path from "node:path";
import fs from "node:fs";
import type { NextFunction, Request, Response } from "express";
import * as ngoReportService from "../services/ngoReportService.js";

export async function generateReport(request: Request, response: Response, _next: NextFunction) {
  const { crisisId } = request.params;
  const adminId = request.authUser!.userId;
  const { assignedVolunteers, resources } = request.body;

  const report = await ngoReportService.generateNGOReportPDF(
    crisisId as string,
    adminId,
    { assignedVolunteers, resources }
  );
  response.status(201).json(report);
}

// Create a draft after-action report with editable sections
export async function createDraft(request: Request, response: Response, _next: NextFunction) {
  const { crisisId } = request.params;
  const adminId = request.authUser!.userId;

  try {
    const report = await ngoReportService.createDraftReport(crisisId as string, adminId);
    response.status(201).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create draft report";
    const status = message.includes("not found") ? 404 : message.includes("only be generated") ? 400 : 500;
    response.status(status).json({ message });
  }
}

// Update editable sections of a draft report
export async function updateSections(request: Request, response: Response, _next: NextFunction) {
  const { reportId } = request.params;
  const sections = request.body;

  try {
    const report = await ngoReportService.updateReportSections(reportId as string, sections);
    response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sections";
    response.status(400).json({ message });
  }
}

// Generate the final PDF from edited sections
export async function generatePDF(request: Request, response: Response, _next: NextFunction) {
  const { reportId } = request.params;

  try {
    const report = await ngoReportService.generatePDFFromSections(reportId as string);
    response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    response.status(400).json({ message });
  }
}

export async function listReports(request: Request, response: Response, _next: NextFunction) {
  const crisisId = request.query.crisisId as string | undefined;
  const reports = await ngoReportService.listNGOReports(crisisId);
  response.status(200).json(reports);
}

export async function getReport(request: Request, response: Response, _next: NextFunction) {
  const { id } = request.params;
  const report = await ngoReportService.getNGOReportById(id as string);
  if (!report) {
    return response.status(404).json({ message: "Report not found" });
  }
  response.status(200).json(report);
}

export async function openReportFile(request: Request, response: Response, _next: NextFunction) {
  const report = await ngoReportService.ensureNGOReportFile(request.params.id as string) as { fileUrl: string };
  if (!report.fileUrl || !report.fileUrl.startsWith("/uploads/")) {
    return response.status(400).json({ message: "Invalid file URL" });
  }
  const filePath = path.resolve(process.cwd(), report.fileUrl.replace(/^\/+/, ""));
  if (!fs.existsSync(filePath)) {
    return response.status(404).json({ message: "Report file not found" });
  }
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
  return response.sendFile(filePath);
}
