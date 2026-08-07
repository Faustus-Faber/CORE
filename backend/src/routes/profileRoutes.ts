import { Router } from "express";
import { z } from "zod";

import {
  updateCurrentPassword,
  updateCurrentProfile,
  toggleDispatchOptIn,
  getMyDispatchLogs
} from "../controllers/profileController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { prisma } from "../lib/prisma.js";
import { getTrustTierInfo } from "../services/trustTierService.js";

export const profileRoutes = Router();

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  source: z.enum(["gps", "map_pin", "manual"]).default("manual")
});

profileRoutes.patch("/", requireAuth, asyncHandler(updateCurrentProfile));
profileRoutes.post(
  "/change-password",
  requireAuth,
  asyncHandler(updateCurrentPassword)
);

// P1: Location consent endpoints — explicit set/delete for user coordinates
profileRoutes.patch(
  "/location",
  requireAuth,
  asyncHandler(async (request, response) => {
    const parsed = locationSchema.parse(request.body);
    const updated = await prisma.user.update({
      where: { id: request.authUser!.userId },
      data: {
        latitude: parsed.latitude,
        longitude: parsed.longitude
      },
      select: { latitude: true, longitude: true }
    });
    return response.status(200).json({
      message: "Location updated",
      location: updated
    });
  })
);

profileRoutes.delete(
  "/location",
  requireAuth,
  asyncHandler(async (request, response) => {
    await prisma.user.update({
      where: { id: request.authUser!.userId },
      data: {
        latitude: null,
        longitude: null
      }
    });
    return response.status(200).json({ message: "Location cleared" });
  })
);

profileRoutes.patch("/dispatch-opt-in", requireAuth, asyncHandler(toggleDispatchOptIn));
profileRoutes.get("/dispatch-logs", requireAuth, asyncHandler(getMyDispatchLogs));
// Backward compatibility for older frontend clients.
profileRoutes.get("/sms-logs", requireAuth, asyncHandler(getMyDispatchLogs));

// Trust tier info — returns current tier + progress to next tier
profileRoutes.get(
  "/trust-tier",
  requireAuth,
  requireRole("VOLUNTEER"),
  asyncHandler(async (request, response) => {
    const info = await getTrustTierInfo(request.authUser!.userId);
    return response.status(200).json(info);
  })
);
