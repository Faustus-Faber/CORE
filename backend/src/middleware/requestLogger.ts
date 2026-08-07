/**
 * Structured request logging middleware with latency tracking.
 *
 * Per refinement plan §15.4:
 *   - "request rate, latency, status, and request ID"
 *   - Structured JSON logs for observability
 *
 * Logs each completed request as a JSON line with:
 *   - timestamp, requestId, method, path, statusCode, latencyMs
 *   - Records metrics for the /metrics endpoint
 */

import type { NextFunction, Request, Response } from "express";

import { metrics } from "../utils/metrics.js";

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log when the response finishes
  response.on("finish", () => {
    const latencyMs = Date.now() - startTime;
    const { method, path } = request;
    const statusCode = response.statusCode;
    const requestId = request.requestId ?? "unknown";

    // Record metrics
    metrics.recordRequest(statusCode, latencyMs);

    // Structured JSON log line
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info",
      requestId,
      method,
      path,
      statusCode,
      latencyMs,
    };

    // Use stdout for info/warn, stderr for errors
    if (statusCode >= 500) {
      console.error(JSON.stringify(logEntry));
    } else if (statusCode >= 400) {
      console.warn(JSON.stringify(logEntry));
    } else {
      // Only log non-2xx/3xx at info level in production to reduce noise
      // Always log in development
      if (process.env.NODE_ENV !== "production" || statusCode >= 400) {
        console.log(JSON.stringify(logEntry));
      }
    }
  });

  return next();
}
