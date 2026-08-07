import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getCrisisWorkspace } from "../services/workspaceService.js";
import { getCrisisEvidenceSummary } from "../services/claimService.js";
import { getTriageCandidates } from "../services/triageService.js";
import { getCandidateResponders, getCandidateResources } from "../services/responsePlanService.js";

export const workspaceRoutes = Router();

// FR-05: Crisis workspace
workspaceRoutes.get("/crises/:id/workspace", requireAuth, async (request, response) => {
  try {
    const crisisId = String(request.params.id);
    const workspace = await getCrisisWorkspace(crisisId);
    // Attach the real evidence summary — replaces opaque credibility score
    const evidenceSummary = await getCrisisEvidenceSummary(crisisId);
    response.json({ data: { ...workspace, evidenceSummary } });
  } catch (error) {
    const isNotFound = error instanceof Error && error.message.includes("not found");
    console.error("Workspace error:", error);
    if (isNotFound) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    } else {
      response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    }
  }
});

// FR-04: Triage candidates for a report
workspaceRoutes.get("/triage/signals/:reportId/candidates", requireAuth, async (request, response) => {
  try {
    const result = await getTriageCandidates(String(request.params.reportId));
    response.json(result);
  } catch (error) {
    const isNotFound = error instanceof Error && error.message.includes("not found");
    console.error("Triage error:", error);
    if (isNotFound) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    } else {
      response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    }
  }
});

// FR-06: Candidate responders for a need
workspaceRoutes.get("/crises/:crisisId/needs/:needId/candidate-responders", requireAuth, async (request, response) => {
  try {
    const responders = await getCandidateResponders(
      String(request.params.crisisId),
      String(request.params.needId)
    );
    response.json({ data: responders });
  } catch (error) {
    const isNotFound = error instanceof Error && error.message.includes("not found");
    console.error("Candidate responders error:", error);
    if (isNotFound) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    } else {
      response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    }
  }
});

// FR-08: Candidate resources for a need
workspaceRoutes.get("/crises/:crisisId/needs/:needId/candidate-resources", requireAuth, async (request, response) => {
  try {
    const resources = await getCandidateResources(
      String(request.params.crisisId),
      String(request.params.needId)
    );
    response.json({ data: resources });
  } catch (error) {
    const isNotFound = error instanceof Error && error.message.includes("not found");
    console.error("Candidate resources error:", error);
    if (isNotFound) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    } else {
      response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    }
  }
});

