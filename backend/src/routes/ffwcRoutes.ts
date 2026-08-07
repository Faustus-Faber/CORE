/**
 * FFWC (Flood Forecasting and Warning Centre) route.
 *
 * Per refinement plan §15.5 / §19:
 *   "official Bangladesh sources such as FFWC where an authorized API is available"
 *
 * GET /api/ffwc/water-levels → current water level readings from FFWC
 *
 * Returns a degraded response if the FFWC API is not configured or unavailable.
 * Does NOT scrape or republish official warnings.
 */

import { Router } from "express";
import { fetchFfwcWaterLevels } from "../services/ffwcAdapter.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const ffwcRoutes = Router();

ffwcRoutes.get("/water-levels", requireAuth, asyncHandler(async (_request, response) => {
  const result = await fetchFfwcWaterLevels();
  return response.status(200).json(result);
}));
