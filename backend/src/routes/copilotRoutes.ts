import { Router } from "express";
import { z } from "zod";

import {
  askCopilot,
  createActionDraft,
  confirmActionDraft,
  rejectActionDraft,
  listActionDrafts
} from "../services/copilotService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const copilotRoutes = Router();

// Constrained AI question — read-only
copilotRoutes.post(
  "/query",
  requireAuth,
  asyncHandler(async (request, response) => {
    const { crisisEventId, question } = request.body;
    if (!crisisEventId || !question) {
      return response.status(400).json({ message: "crisisEventId and question are required" });
    }
    const result = await askCopilot(request.authUser!.userId, {
      crisisEventId,
      question: String(question).slice(0, 500)
    });
    return response.status(200).json(result);
  })
);

// List drafts for a crisis (coordinator view)
copilotRoutes.get(
  "/drafts/:crisisEventId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const { status } = request.query;
    const drafts = await listActionDrafts(crisisEventId, status as string | undefined);
    return response.status(200).json({ drafts });
  })
);

// Create a new action draft (coordinator proposes a change)
copilotRoutes.post(
  "/drafts",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const parsed = z.object({
      crisisEventId: z.string().min(1),
      draftType: z.enum(["DISPATCH", "ALLOCATION", "STATUS_CHANGE", "ALERT"]),
      payload: z.record(z.any()),
      reasoning: z.string().min(10),
      sourceIds: z.array(z.string()).optional(),
      expiresInHours: z.number().optional()
    }).parse(request.body);

    const draft = await createActionDraft(request.authUser!.userId, parsed as any);
    return response.status(201).json({ draft });
  })
);

// Confirm a draft (coordinator approves and executes)
copilotRoutes.post(
  "/drafts/:id/confirm",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const draftId = String(request.params.id);
    const result = await confirmActionDraft(draftId, request.authUser!.userId);
    return response.status(200).json(result);
  })
);

// Reject a draft (coordinator cancels the proposal)
copilotRoutes.post(
  "/drafts/:id/reject",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const draftId = String(request.params.id);
    const { reason } = request.body;
    const draft = await rejectActionDraft(draftId, request.authUser!.userId, String(reason ?? ""));
    return response.status(200).json({ draft });
  })
);

export default copilotRoutes;
