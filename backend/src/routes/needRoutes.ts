import { Router } from "express";
import { z } from "zod";

import {
  createNeed,
  getNeedsForCrisis,
  getNeedsGap,
  proposeAllocation,
  decideAllocation,
  deliverAllocation
} from "../services/needService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const needRoutes = Router();

const createNeedSchema = z.object({
  crisisEventId: z.string().min(1),
  needType: z.string().min(1),
  description: z.string().min(5),
  quantity: z.number().int().min(1),
  unit: z.string().min(1),
  urgency: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  sourceClaimId: z.string().optional(),
  dueAt: z.string().optional()
});

const allocateSchema = z.object({
  needId: z.string().min(1),
  resourceId: z.string().min(1),
  quantity: z.number().int().min(1)
});

// Coordinator creates a need for a crisis
needRoutes.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const parsed = createNeedSchema.parse(request.body);
    const need = await createNeed(request.authUser!.userId, parsed);
    return response.status(201).json({ need });
  })
);

// Get needs for a crisis (with allocation status)
needRoutes.get(
  "/crisis/:crisisEventId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const needs = await getNeedsForCrisis(crisisEventId);
    return response.status(200).json({ needs });
  })
);

// Compute unmet needs (gap analysis — deterministic)
needRoutes.get(
  "/gap/:crisisEventId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const gaps = await getNeedsGap(crisisEventId);
    return response.status(200).json({ gaps });
  })
);

// Propose an allocation (request stock from a resource)
needRoutes.post(
  "/allocations",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const parsed = allocateSchema.parse(request.body);
    const result = await proposeAllocation(request.authUser!.userId, parsed.needId, parsed.resourceId, parsed.quantity);
    return response.status(201).json(result);
  })
);

// Approve or decline an allocation
needRoutes.patch(
  "/allocations/:id/decide",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const allocationId = String(request.params.id);
    const { decision, note } = request.body;
    if (!decision || !["APPROVED", "DECLINED"].includes(decision)) {
      return response.status(400).json({ message: "decision must be APPROVED or DECLINED" });
    }
    if (note != null && (typeof note !== "string" || note.length > 1000)) {
      return response.status(400).json({ message: "note must be a string of at most 1000 characters" });
    }
    const updated = await decideAllocation(request.authUser!.userId, allocationId, decision, note);
    return response.status(200).json({ allocation: updated });
  })
);

// Mark allocation as delivered
needRoutes.patch(
  "/allocations/:id/deliver",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const allocationId = String(request.params.id);
    const { note, deliveredQuantity } = request.body;
    if (!note || typeof note !== "string" || note.length > 1000 || typeof deliveredQuantity !== "number" || deliveredQuantity <= 0) {
      return response.status(400).json({ message: "note (max 1000 chars) and a positive deliveredQuantity are required" });
    }
    const updated = await deliverAllocation(request.authUser!.userId, allocationId, note, deliveredQuantity);
    return response.status(200).json({ allocation: updated });
  })
);

export default needRoutes;
