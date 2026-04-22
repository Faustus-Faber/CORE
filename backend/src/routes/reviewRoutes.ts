import { Router } from "express";

import {
    approveReviewHandler,
    approveVolunteerHandler,
    banVolunteerHandler,
    createReview,
    getEligibleReviewCrisesHandler,
    deleteReviewHandler,
    getFlaggedReviewsHandler,
    getFlaggedVolunteersHandler,
    getVolunteerReviewsHandler
} from "../controllers/reviewController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const reviewRoutes = Router();

reviewRoutes.post("/", requireAuth, asyncHandler(createReview));
reviewRoutes.get(
    "/volunteer/:volunteerId/eligible-crises",
    requireAuth,
    asyncHandler(getEligibleReviewCrisesHandler)
);
reviewRoutes.get(
    "/volunteer/:volunteerId",
    requireAuth,
    asyncHandler(getVolunteerReviewsHandler)
);
reviewRoutes.get(
    "/flagged",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(getFlaggedReviewsHandler)
);
reviewRoutes.get(
    "/flagged-volunteers",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(getFlaggedVolunteersHandler)
);
reviewRoutes.patch(
    "/:id/approve",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(approveReviewHandler)
);
reviewRoutes.delete(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(deleteReviewHandler)
);
reviewRoutes.patch(
    "/volunteer/:id/approve",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(approveVolunteerHandler)
);
reviewRoutes.post(
    "/volunteer/:id/ban",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(banVolunteerHandler)
);
