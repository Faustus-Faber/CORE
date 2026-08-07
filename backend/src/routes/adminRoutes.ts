import { Router, type Request, type Response } from "express";

import {
  approveReviewHandler,
  approveVolunteerHandler,
  banVolunteerHandler,
  deleteReviewHandler,
  getFlaggedReviewsHandler,
  getFlaggedVolunteersHandler,
  linkReportToCrisisHandler,
  listUnpublishedReports,
  listUsers,
  unlinkReportFromCrisis,
  updateReportStatus,
  updateUserBanStatus,
  updateUserRole
} from "../controllers/adminController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { prisma } from "../lib/prisma.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("ADMIN"));
adminRoutes.get("/users", asyncHandler(listUsers));
adminRoutes.patch("/users/:userId/role", asyncHandler(updateUserRole));
adminRoutes.patch("/users/:userId/ban", asyncHandler(updateUserBanStatus));
adminRoutes.get("/reports/unpublished", asyncHandler(listUnpublishedReports));
adminRoutes.patch("/reports/:reportId/status", asyncHandler(updateReportStatus));
adminRoutes.delete("/reports/:reportId/crisis-link", asyncHandler(unlinkReportFromCrisis));
adminRoutes.post("/reports/:reportId/crisis-link", asyncHandler(linkReportToCrisisHandler));
adminRoutes.get("/reviews/flagged", asyncHandler(getFlaggedReviewsHandler));
adminRoutes.get("/volunteers/flagged", asyncHandler(getFlaggedVolunteersHandler));
adminRoutes.patch("/reviews/:id/approve", asyncHandler(approveReviewHandler));
adminRoutes.delete("/reviews/:id", asyncHandler(deleteReviewHandler));
adminRoutes.patch("/volunteers/:id/approve", asyncHandler(approveVolunteerHandler));
adminRoutes.post("/volunteers/:id/ban", asyncHandler(banVolunteerHandler));

// ── Trust tier oversight: list all volunteers with tier + stats ─────────────
adminRoutes.get(
  "/trust-tiers",
  asyncHandler(async (_req: Request, res: Response) => {
    const volunteers = await prisma.user.findMany({
      where: { role: "VOLUNTEER", isBanned: false },
      select: {
        id: true,
        fullName: true,
        email: true,
        trustTier: true,
        totalPoints: true,
        totalVerifiedHours: true,
        isFlagged: true,
        isBanned: true,
        createdAt: true,
        responderProfile: { select: { approvalStatus: true } },
        _count: {
          select: {
            crisisMessages: true,
            vouchesGiven: true,
            vouchesReceived: true,
          },
        },
      },
      orderBy: { totalPoints: "desc" },
    });

    // Get verified report + approved observation counts for each volunteer
    const volunteerIds = volunteers.map((v) => v.id);

    const [verifiedReports, approvedObs] = await Promise.all([
      prisma.incidentReport.groupBy({
        by: ["reporterId"],
        where: { reporterId: { in: volunteerIds }, status: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.crisisEventUpdate.groupBy({
        by: ["updaterId"],
        where: {
          updaterId: { in: volunteerIds },
          updateType: "FIELD_OBSERVATION",
          verificationStatus: "ADMIN_CONFIRMED",
          dismissedAt: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

    const reportMap = new Map(verifiedReports.map((r) => [r.reporterId, r._count._all]));
    const obsMap = new Map(approvedObs.map((o) => [o.updaterId, o._count._all]));

    return res.status(200).json({
      volunteers: volunteers.map((v) => ({
        id: v.id,
        fullName: v.fullName,
        email: v.email,
        trustTier: v.trustTier,
        totalPoints: v.totalPoints,
        totalVerifiedHours: v.totalVerifiedHours,
        isFlagged: v.isFlagged,
        isBanned: v.isBanned,
        responderStatus: v.responderProfile?.approvalStatus ?? null,
        verifiedReportCount: reportMap.get(v.id) ?? 0,
        approvedObservationCount: obsMap.get(v.id) ?? 0,
        vouchesGivenCount: v._count.vouchesGiven,
        vouchesReceivedCount: v._count.vouchesReceived,
        messageCount: v._count.crisisMessages,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  })
);
