import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  listUsersForAdmin,
  setUserBanStatusByAdmin,
  setUserRoleByAdmin
} from "../services/authService.js";
import {
  listUnderReviewIncidentReports,
  linkReportToCrisisEvent,
  unlinkReportFromCrisisEvent,
  updateIncidentReportStatusByAdmin
} from "../services/reportService.js";
import {
  approveReview,
  approveVolunteer,
  banVolunteer,
  deleteReview,
  listFlaggedReviews,
  listFlaggedVolunteers
} from "../services/reviewService.js";
import { validateReportListQueryInput } from "../utils/validation.js";
import { metrics } from "../utils/metrics.js";
import { logAuditEvent } from "../services/auditService.js";

const roleSchema = z.object({
  role: z.enum(["USER", "VOLUNTEER"])
});

const banSchema = z.object({
  isBanned: z.boolean()
});

const reportStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "UNDER_REVIEW", "REJECTED", "CLARIFICATION_REQUESTED", "MERGED"]),
  reason: z.string().optional()
});

// AC-04.04: Validation for the unlink report-from-crisis request body (optional reason)
const unlinkReportSchema = z.object({
  reason: z.string().optional()
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
  const actorId = request.authUser?.userId;
  const updated = await setUserRoleByAdmin(userId, role);
  metrics.recordAdminAction();
  if (actorId) {
    await logAuditEvent({
      actorId,
      actorRole: "ADMIN",
      action: "USER_ROLE_CHANGED",
      targetType: "User",
      targetId: userId,
      afterJson: JSON.stringify({ role })
    }).catch((err) => console.error("[audit] Failed to log role change:", err));
  }
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
  const actorId = request.authUser?.userId;
  const updated = await setUserBanStatusByAdmin(userId, isBanned);
  metrics.recordAdminAction();
  if (actorId) {
    await logAuditEvent({
      actorId,
      actorRole: "ADMIN",
      action: isBanned ? "USER_BANNED" : "USER_UNBANNED",
      targetType: "User",
      targetId: userId
    }).catch((err) => console.error("[audit] Failed to log ban status change:", err));
  }
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
  const { status, reason } = reportStatusSchema.parse(request.body);
  const reportId = String(request.params.reportId);
  const actorId = request.authUser?.userId;
  const updated = await updateIncidentReportStatusByAdmin(reportId, status);
  metrics.recordAdminAction();
  if (actorId) {
    await logAuditEvent({
      actorId,
      actorRole: "ADMIN",
      action: `REPORT_${status}`,
      targetType: "IncidentReport",
      targetId: reportId,
      afterJson: JSON.stringify({ status, reason })
    }).catch((err) => console.error("[audit] Failed to log report status change:", err));
  }

  const messages: Record<string, string> = {
    PUBLISHED: "Report published successfully",
    UNDER_REVIEW: "Report kept under review",
    REJECTED: "Report rejected",
    CLARIFICATION_REQUESTED: "Clarification requested from reporter",
    MERGED: "Report merged into existing crisis event"
  };

  return response.status(200).json({
    message: messages[status] ?? "Report status updated",
    report: updated,
    reason
  });
}

// ── Review Moderation ───────────────────────────────────────────────────────

export async function getFlaggedReviewsHandler(
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  const reviews = await listFlaggedReviews();
  return response.status(200).json({ reviews });
}

export async function getFlaggedVolunteersHandler(
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  const volunteers = await listFlaggedVolunteers();
  return response.status(200).json({ volunteers });
}

export async function approveReviewHandler(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reviewId = String(request.params.id);
  await approveReview(reviewId);
  metrics.recordAdminAction();
  await logAuditEvent({
    actorId: request.authUser!.userId,
    action: "REVIEW_APPROVED",
    targetType: "Review",
    targetId: reviewId,
  });
  return response.status(200).json({ message: "Review approved" });
}

export async function deleteReviewHandler(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reviewId = String(request.params.id);
  await deleteReview(reviewId);
  metrics.recordAdminAction();
  await logAuditEvent({
    actorId: request.authUser!.userId,
    action: "REVIEW_DELETED",
    targetType: "Review",
    targetId: reviewId,
  });
  return response.status(200).json({ message: "Review deleted" });
}

export async function approveVolunteerHandler(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const volunteerId = String(request.params.id);
  await approveVolunteer(volunteerId);
  metrics.recordAdminAction();
  await logAuditEvent({
    actorId: request.authUser!.userId,
    action: "VOLUNTEER_APPROVED",
    targetType: "User",
    targetId: volunteerId,
  });
  return response.status(200).json({ message: "Volunteer flag cleared" });
}

export async function banVolunteerHandler(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const volunteerId = String(request.params.id);
  await banVolunteer(volunteerId);
  metrics.recordAdminAction();
  await logAuditEvent({
    actorId: request.authUser!.userId,
    action: "VOLUNTEER_BANNED",
    targetType: "User",
    targetId: volunteerId,
  });
  return response.status(200).json({ message: "Volunteer banned" });
}

// ── AC-04.04: Unlink report from crisis event ────────────────────────────────

export async function unlinkReportFromCrisis(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reportId = String(request.params.reportId);
  const actorId = request.authUser?.userId;

  if (!actorId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  // Validate the optional reason field if a body is present
  if (request.body && Object.keys(request.body).length > 0) {
    unlinkReportSchema.parse(request.body);
  }

  try {
    const updated = await unlinkReportFromCrisisEvent(reportId, actorId);
    metrics.recordAdminAction();
    return response.status(200).json({
      message: "Report unlinked from crisis event",
      report: updated
    });
  } catch (error) {
    console.error("Failed to unlink report:", error);
    return response.status(404).json({ message: "Failed to unlink report" });
  }
}

// ── Link report to crisis event (manual merge) ───────────────────────────────

const linkReportSchema = z.object({
  crisisEventId: z.string().min(1)
});

export async function linkReportToCrisisHandler(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const reportId = String(request.params.reportId);
  const actorId = request.authUser?.userId;
  const { crisisEventId } = linkReportSchema.parse(request.body);

  if (!actorId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  try {
    const updated = await linkReportToCrisisEvent(reportId, crisisEventId, actorId);
    metrics.recordAdminAction();
    return response.status(200).json({
      message: "Report linked to crisis event",
      report: updated
    });
  } catch (error) {
    console.error("Failed to link report:", error);
    const message = error instanceof Error ? error.message : "Failed to link report";
    return response.status(400).json({ message });
  }
}
