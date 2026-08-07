import { Router } from "express";
import { z } from "zod";

import {
  calculateVelocityAndRisk,
  generateBrief,
  getBriefsForCrisis,
  getStaleBriefWarning,
  publishBrief,
  reviewBrief
} from "../services/briefService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const briefRoutes = Router();

const generateSchema = z.object({
  crisisEventId: z.string().min(1)
});

const publishSchema = z.object({
  note: z.string().optional()
});

// coordinator generates a draft brief
briefRoutes.post(
  "/generate",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const parsed = generateSchema.parse(request.body);
    const brief = await generateBrief(parsed.crisisEventId, request.authUser!.userId);
    return response.status(201).json({ brief });
  })
);

// list briefs for a crisis
briefRoutes.get(
  "/crisis/:crisisEventId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const briefs = await getBriefsForCrisis(crisisEventId);
    return response.status(200).json({ briefs });
  })
);

// get latest published brief for a crisis with stale warning (§14.7)
briefRoutes.get(
  "/crisis/:crisisEventId/latest",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const result = await getStaleBriefWarning(crisisEventId);
    return response.status(200).json(result);
  })
);

// get claim velocity and escalation risk metrics
briefRoutes.get(
  "/crisis/:crisisEventId/velocity",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const velocity = await calculateVelocityAndRisk(crisisEventId);
    return response.status(200).json(velocity);
  })
);

// get latest published brief for a crisis — alias endpoint (§14.7)
briefRoutes.get(
  "/:crisisEventId/latest",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const result = await getStaleBriefWarning(crisisEventId);
    return response.status(200).json(result);
  })
);

// coordinator reviews a brief
briefRoutes.patch(
  "/:id/review",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const briefId = String(request.params.id);
    const { note } = request.body;
    if (note != null && (typeof note !== "string" || note.length > 2000)) {
      return response.status(400).json({ message: "note must be a string of at most 2000 characters" });
    }
    const brief = await reviewBrief(briefId, request.authUser!.userId, note || "");
    return response.status(200).json({ brief });
  })
);

// coordinator publishes a brief
briefRoutes.patch(
  "/:id/publish",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const briefId = String(request.params.id);
    const parsed = publishSchema.parse(request.body);
    const brief = await publishBrief(briefId, request.authUser!.userId, parsed.note);
    return response.status(200).json({ brief });
  })
);

export default briefRoutes;
