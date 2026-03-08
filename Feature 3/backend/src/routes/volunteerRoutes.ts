import { Router } from "express";

import { getVolunteerProfile, listVolunteers } from "../controllers/volunteerController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const volunteerRoutes = Router();

// GET /api/volunteers -> List all volunteers (must be authenticated to view directory)
volunteerRoutes.get("/", requireAuth, asyncHandler(listVolunteers));

// GET /api/volunteers/:volunteerId -> Get volunteer profile with flag status
volunteerRoutes.get("/:volunteerId", requireAuth, asyncHandler(getVolunteerProfile));
