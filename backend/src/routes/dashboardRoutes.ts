import { Router } from "express";

import {
  getFeed,
  getSitRep,
  getIncidentById,
  streamCriticalIncidents
} from "../controllers/dashboardController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/feed", requireAuth, asyncHandler(getFeed));
dashboardRoutes.get("/sitrep", requireAuth, asyncHandler(getSitRep));
dashboardRoutes.get("/critical-incidents/stream", requireAuth, streamCriticalIncidents);
dashboardRoutes.get("/incidents/:id", requireAuth, asyncHandler(getIncidentById));