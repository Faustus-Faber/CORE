import { Router } from "express";
import { z } from "zod";

import {
  proposeAssignment,
  offerAssignment,
  acceptAssignment,
  updateAssignmentStatus,
  approveAssignmentOutcome,
  getAssignmentsForCrisis,
  getAssignmentsForVolunteer,
  recommendVolunteersForCrisis
} from "../services/assignmentService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const assignmentRoutes = Router();

const proposeSchema = z.object({
  crisisEventId: z.string().min(1),
  volunteerId: z.string().min(1),
  needId: z.string().optional()
});

const transitionSchema = z.object({
  status: z.enum(["OFFERED", "ACCEPTED", "EN_ROUTE", "ON_SITE", "COMPLETED", "DECLINED", "CANCELLED"]),
  note: z.string().optional()
});

// Coordinator proposes a new assignment
assignmentRoutes.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const parsed = proposeSchema.parse(request.body);
    const assignment = await proposeAssignment(
      parsed.crisisEventId,
      parsed.volunteerId,
      request.authUser!.userId,
      parsed.needId
    );
    return response.status(201).json({ assignment });
  })
);

// Coordinator offers the assignment to the volunteer
assignmentRoutes.patch(
  "/:id/offer",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const assignment = await offerAssignment(String(request.params.id), request.authUser!.userId);
    return response.status(200).json({ assignment });
  })
);

// Volunteer accepts the assignment
assignmentRoutes.patch(
  "/:id/accept",
  requireAuth,
  asyncHandler(async (request, response) => {
    const assignment = await acceptAssignment(String(request.params.id), request.authUser!.userId);
    return response.status(200).json({ assignment });
  })
);

// Transition assignment status (accept/en-route/on-site/completed/cancelled)
assignmentRoutes.patch(
  "/:id/transition",
  requireAuth,
  asyncHandler(async (request, response) => {
    const parsed = transitionSchema.parse(request.body);
    const assignment = await updateAssignmentStatus(
      String(request.params.id),
      parsed.status,
      request.authUser!.userId,
      parsed.note
    );
    return response.status(200).json({ assignment });
  })
);

// Coordinator approves a completed assignment outcome
assignmentRoutes.patch(
  "/:id/outcome/approve",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const assignment = await approveAssignmentOutcome(String(request.params.id), request.authUser!.userId);
    return response.status(200).json({ assignment });
  })
);

// List assignments for a crisis (volunteers see only their own)
assignmentRoutes.get(
  "/crisis/:crisisEventId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const isAdmin = request.authUser?.role === "ADMIN";

    const assignments = await getAssignmentsForCrisis(crisisEventId);

    // Non-admins can only see their own assignments
    if (!isAdmin) {
      const mine = assignments.filter(a => a.volunteerId === request.authUser!.userId);
      return response.status(200).json({ assignments: mine });
    }

    return response.status(200).json({ assignments });
  })
);

// List assignments for a specific volunteer
assignmentRoutes.get(
  "/volunteer/:volunteerId",
  requireAuth,
  asyncHandler(async (request, response) => {
    // Users can only view their own volunteer assignments unless admin
    const volunteerId = String(request.params.volunteerId);
    if (request.authUser!.userId !== volunteerId && request.authUser?.role !== "ADMIN") {
      return response.status(403).json({ message: "Forbidden" });
    }

    const assignments = await getAssignmentsForVolunteer(volunteerId);
    return response.status(200).json({ assignments });
  })
);

// AC-06.04: Recommend volunteers for a crisis with constraint explanations
const recommendSchema = z.object({
  requiredSkills: z.array(z.string()).optional(),
  maxDistanceKm: z.number().min(1).max(500).optional(),
  limit: z.number().min(1).max(50).optional(),
});

assignmentRoutes.get(
  "/recommend/:crisisEventId",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const parsed = recommendSchema.parse(request.query);
    const recommendations = await recommendVolunteersForCrisis(crisisEventId, parsed);
    return response.status(200).json({ recommendations });
  })
);

export default assignmentRoutes;
