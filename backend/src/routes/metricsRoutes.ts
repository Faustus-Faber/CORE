/**
 * Metrics endpoint — exposes operational metrics for observability.
 *
 * Per refinement plan §15.4:
 *   - request rate, latency, status
 *   - AI latency, failure, retries, circuit breaker trips
 *   - job queue depth (from outbox)
 *
 * GET /metrics → JSON snapshot of in-process metrics + outbox stats
 */

import { Router } from "express";

import { metrics } from "../utils/metrics.js";
import { getOutboxStats } from "../services/outboxService.js";
import { getCircuitBreakerState } from "../services/aiService.js";
import { requireAuth } from "../middleware/auth.js";

export const metricsRoutes = Router();

/**
 * GET /metrics — operational metrics snapshot.
 * Requires authentication (admin/coordinator) to avoid exposing operational data publicly.
 */
metricsRoutes.get("/", requireAuth, async (_request, response) => {
  try {
    const outboxStats = await getOutboxStats();
    const snapshot = metrics.getSnapshot();
    const circuitBreaker = getCircuitBreakerState();

    return response.status(200).json({
      ...snapshot,
      outbox: outboxStats,
      circuitBreaker,
    });
  } catch (error) {
    console.error("Metrics collection failed:", error);
    return response.status(500).json({
      message: "Failed to collect metrics",
      detail: "See server logs for details",
    });
  }
});
