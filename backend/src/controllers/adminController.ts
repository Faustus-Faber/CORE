import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  listUsersForAdmin,
  setUserBanStatusByAdmin,
  setUserRoleByAdmin
} from "../services/authService.js";
import {
  listUnderReviewIncidentReports,
  updateIncidentReportStatusByAdmin
} from "../services/reportService.js";
import { validateReportListQueryInput } from "../utils/validation.js";

const roleSchema = z.object({
  role: z.enum(["USER", "VOLUNTEER"])
});

const banSchema = z.object({
  isBanned: z.boolean()
});

const reportStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "UNDER_REVIEW"])
});

export async function listUsers(
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  const users = await listUsersForAdmin();
  return response.status(200).json({ users });
}

export async function updateUserRole(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { role } = roleSchema.parse(request.body);
  const userId = String(request.params.userId);
  const updated = await setUserRoleByAdmin(userId, role);
  return response.status(200).json({
    message: "Role updated",
    user: {
      id: updated.id,
      role: updated.role
    }
  });
}

export async function updateUserBanStatus(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { isBanned } = banSchema.parse(request.body);
  const userId = String(request.params.userId);
  const updated = await setUserBanStatusByAdmin(userId, isBanned);
  return response.status(200).json({
    message: isBanned ? "User banned" : "User unbanned",
    user: {
      id: updated.id,
      isBanned: updated.isBanned
    }
  });
}

export async function listUnpublishedReports(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const query = validateReportListQueryInput(request.query);
  const reports = await listUnderReviewIncidentReports({
    search: query.search,
    severity: query.severity,
    sortBy: query.sortBy,
    order: query.order,
    page: query.page,
    limit: query.limit
  });

  return response.status(200).json({ reports });
}

export async function updateReportStatus(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { status } = reportStatusSchema.parse(request.body);
  const reportId = String(request.params.reportId);
  const updated = await updateIncidentReportStatusByAdmin(reportId, status);

  return response.status(200).json({
    message:
      status === "PUBLISHED" ? "Report published successfully" : "Report kept under review",
    report: updated
  });
}
