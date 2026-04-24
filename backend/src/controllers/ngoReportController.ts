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
  response.redirect(report.fileUrl);
}
