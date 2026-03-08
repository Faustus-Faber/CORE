import { Router } from "express";

import {
  approveReviewHandler,
  approveVolunteerHandler,
  banVolunteerHandler,
  deleteReviewHandler,
  getFlaggedReviewsHandler,
  getFlaggedVolunteersHandler,
  listUnpublishedReports,
  listUsers,
  updateReportStatus,
  updateUserBanStatus,
  updateUserRole
} from "../controllers/adminController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("ADMIN"));
adminRoutes.get("/users", asyncHandler(listUsers));
adminRoutes.patch("/users/:userId/role", asyncHandler(updateUserRole));
adminRoutes.patch("/users/:userId/ban", asyncHandler(updateUserBanStatus));
adminRoutes.get("/reports/unpublished", asyncHandler(listUnpublishedReports));
adminRoutes.patch("/reports/:reportId/status", asyncHandler(updateReportStatus));
adminRoutes.get("/reviews/flagged", asyncHandler(getFlaggedReviewsHandler));
adminRoutes.get("/volunteers/flagged", asyncHandler(getFlaggedVolunteersHandler));
adminRoutes.patch("/reviews/:id/approve", asyncHandler(approveReviewHandler));
adminRoutes.delete("/reviews/:id", asyncHandler(deleteReviewHandler));
adminRoutes.patch("/volunteers/:id/approve", asyncHandler(approveVolunteerHandler));
adminRoutes.post("/volunteers/:id/ban", asyncHandler(banVolunteerHandler));
