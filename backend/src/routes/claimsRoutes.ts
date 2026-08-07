import { Router } from "express";
import { z } from "zod";

import {
  persistClaims,
  getClaimsForCrisis,
  decideClaim,
  extractClaimsFromText
} from "../services/claimService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const claimsRoutes = Router();

// Zod schemas
const createClaimsSchema = z.object({
  incidentReportId: z.string().min(1, "incidentReportId is required"),
  crisisEventId: z.string().min(1, "crisisEventId is required"),
  extractedClaims: z.array(z.object({
    claimType: z.string(),
    subject: z.string().min(1),
    value: z.string().min(1),
    unit: z.string().optional(),
    observedAt: z.string().optional(),
    sourceText: z.string().optional()
  })).min(1)
});

const decideClaimSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT", "SUPERSEDE"]),
  reason: z.string().min(5, "Reason is required"),
  supersedeValue: z.string().optional()
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/claims/extract
 * Extract claims from a report description (calls Groq, does NOT persist).
 * Returns extracted claims for review before saving.
 */
claimsRoutes.post(
  "/extract",
  requireAuth,
  asyncHandler(async (request, response) => {
    const { description, incidentReportId } = request.body;
    if (!description) return response.status(400).json({ message: "description is required" });
    if (typeof description !== "string" || description.length > 10000) {
      return response.status(400).json({ message: "description must be 10,000 characters or less" });
    }

    const extracted = await extractClaimsFromText(incidentReportId, description, request.authUser!.userId);
    return response.status(200).json({ extracted });
  })
);

/**
 * POST /api/claims/persist
 * Persist extracted claims for a crisis. Requires coordinator (ADMIN) role.
 */
claimsRoutes.post(
  "/persist",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const parsed = createClaimsSchema.parse(request.body);
    const claimIds = await persistClaims(
      parsed.crisisEventId,
      parsed.incidentReportId,
      parsed.extractedClaims,
      request.authUser!.userId,
      ""
    );
    return response.status(201).json({ created: claimIds.length, claimIds });
  })
);

/**
 * GET /api/claims/crisis/:crisisEventId
 * Get all claims for a crisis, including contradictions.
 */
claimsRoutes.get(
  "/crisis/:crisisEventId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const crisisEventId = String(request.params.crisisEventId);
    const result = await getClaimsForCrisis(crisisEventId);
    return response.status(200).json(result);
  })
);

/**
 * PATCH /api/claims/:claimId/decide
 * Coordinator decision on a claim (accept / reject / supersede).
 */
claimsRoutes.patch(
  "/:claimId/decide",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const claimId = String(request.params.claimId);
    const parsed = decideClaimSchema.parse(request.body);
    await decideClaim(claimId, request.authUser!.userId, parsed.decision, parsed.reason, parsed.supersedeValue);
    return response.status(200).json({ message: "Decision recorded" });
  })
);

export default claimsRoutes;
