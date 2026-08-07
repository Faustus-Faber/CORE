import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { idempotencyCheck } from "../middleware/idempotency.js";
import { recordFulfillment, listFulfillmentsForAllocation } from "../services/fulfillmentService.js";

export const fulfillmentRoutes = Router();

// Record fulfillment for an allocation
fulfillmentRoutes.post("/allocations/:allocationId/fulfillment", requireAuth, idempotencyCheck, async (request, response) => {
  try {
    const deliveredQuantity = Number(request.body.deliveredQuantity);
    if (!Number.isFinite(deliveredQuantity) || deliveredQuantity <= 0) {
      return response.status(400).json({ error: { code: "INVALID_INPUT", message: "deliveredQuantity must be a positive number" } });
    }
    const recipientName = typeof request.body.recipientName === "string" ? request.body.recipientName.slice(0, 200) : undefined;
    const verificationNote = typeof request.body.verificationNote === "string" ? request.body.verificationNote.slice(0, 2000) : undefined;
    const evidenceUrls = Array.isArray(request.body.evidenceUrls)
      ? request.body.evidenceUrls.filter((u: unknown): u is string => typeof u === "string").slice(0, 10)
      : undefined;

    const fulfillment = await recordFulfillment({
      allocationId: String(request.params.allocationId),
      deliveredQuantity,
      recipientName,
      verificationNote,
      evidenceUrls,
      recordedById: request.authUser!.userId,
      idempotencyKey: (request as any).idempotencyKey,
    });
    response.status(201).json({ data: fulfillment });
  } catch (error) {
    console.error("Fulfillment failed:", error);
    const message = error instanceof Error && error.message.includes("Not authorized") ? error.message : "Failed to record fulfillment";
    const status = error instanceof Error && error.message.includes("Not authorized") ? 403
      : error instanceof Error && error.message.includes("not found") ? 404 : 400;
    response.status(status).json({
      error: { code: "FULFILLMENT_FAILED", message },
    });
  }
});

// List fulfillments for an allocation
fulfillmentRoutes.get("/allocations/:allocationId/fulfillments", requireAuth, async (request, response) => {
  try {
    const fulfillments = await listFulfillmentsForAllocation(String(request.params.allocationId), request.authUser!.userId);
    response.json({ data: fulfillments });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Not authorized") ? error.message : "Failed to list fulfillments";
    const status = error instanceof Error && error.message.includes("Not authorized") ? 403
      : error instanceof Error && error.message.includes("not found") ? 404 : 500;
    response.status(status).json({ error: { code: "INTERNAL_ERROR", message } });
  }
});
