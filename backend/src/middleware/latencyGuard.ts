/**
 * Latency enforcement middleware (§15.1: p95 latency targets).
 *
 * Measures request latency and, when it exceeds a configurable threshold,
 * logs a warning and records a latency violation in the metrics collector.
 *
 * This middleware does NOT reject or short-circuit the request — it only
 * alerts (log + metric) after the response has finished. This keeps the
 * p95 SLO observable without breaking in-flight requests.
 *
 * The threshold defaults to 5000ms (the p95 target). Override with the
 * LATENCY_GUARD_THRESHOLD_MS environment variable.
 */

import type { NextFunction, Request, Response } from "express";

import { metrics } from "../utils/metrics.js";

const DEFAULT_THRESHOLD_MS = 5000;
const thresholdMs = Number(process.env.LATENCY_GUARD_THRESHOLD_MS) || DEFAULT_THRESHOLD_MS;

export function latencyGuard(request: Request, response: Response, next: NextFunction) {
  const startTime = Date.now();

  response.on("finish", () => {
    const latencyMs = Date.now() - startTime;

    if (latencyMs > thresholdMs) {
      // Normalize path to avoid unbounded key growth from dynamic IDs.
      // e.g., /api/reports/abc123 -> /api/reports/:id
      const routePath = request.route?.path ?? request.path;
      const normalizedPath = routePath
        .split("/")
        .map((segment: string) => /^[a-fA-F0-9]{24}$/.test(segment) ? ":id" : segment)
        .join("/");
      const endpoint = `${request.method} ${normalizedPath}`;
      const requestId = request.requestId ?? "unknown";

      // Record the violation in metrics (per-endpoint tracking)
      metrics.recordLatencyViolation(endpoint);

      // Log a structured warning so operators can investigate
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        type: "latency_violation",
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        latencyMs,
        thresholdMs,
        message: `Request exceeded p95 latency target (${latencyMs}ms > ${thresholdMs}ms threshold)`,
      }));
    }
  });

  return next();
}
