/**
 * Responder approval routes — auto-approval by points, admin can only suspend/reinstate.
 *
 * FR-01 (revised): Volunteers are automatically elevated to APPROVED responder
 * status once they accumulate 100+ points through verified tasks. Manual
 * admin approval has been removed — trust is earned through verified field work.
 * Admins retain the ability to SUSPEND problematic responders and REINSTATE them.
 *
 * GET   /admin/responders                    → list all responder profiles
 * PATCH /admin/responders/:userId/suspend    → suspend an approved responder
 * PATCH /admin/responders/:userId/reinstate  → reinstate a suspended responder
 */

import { Router, type Request, type Response } from "express";
import type { ResponderApprovalStatus } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  listResponderProfiles,
  transitionResponderApproval,
} from "../services/responderApprovalService.js";

export const responderApprovalRoutes = Router();

responderApprovalRoutes.use(requireAuth, requireRole("ADMIN"));

responderApprovalRoutes.get(
  "/responders",
  asyncHandler(async (request: Request, response: Response) => {
    const status = request.query.status as ResponderApprovalStatus | undefined;
    const profiles = await listResponderProfiles(status);
    return response.status(200).json({ profiles });
  })
);

responderApprovalRoutes.patch(
  "/responders/:userId/suspend",
  asyncHandler(async (request: Request, response: Response) => {
    const adminId = request.authUser!.userId;
    const result = await transitionResponderApproval(
      String(request.params.userId),
      "SUSPENDED",
      adminId
    );
    return response.status(200).json({ message: "Responder suspended", profile: result });
  })
);

responderApprovalRoutes.patch(
  "/responders/:userId/reinstate",
  asyncHandler(async (request: Request, response: Response) => {
    const adminId = request.authUser!.userId;
    const result = await transitionResponderApproval(
      String(request.params.userId),
      "APPROVED",
      adminId
    );
    return response.status(200).json({ message: "Responder reinstated", profile: result });
  })
);

