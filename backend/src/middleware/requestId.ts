import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      csrfToken?: string;
      idempotencyKey?: string;
    }
  }
}

/**
 * Request ID middleware — generates or propagates a unique request ID for tracing.
 * Sets X-Request-ID header and makes it available on request.requestId.
 */
export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  // Use existing X-Request-ID from client if provided, otherwise generate
  const requestId = request.headers["x-request-id"] as string || randomUUID();

  // Set response header for tracing
  response.setHeader("X-Request-ID", requestId);

  // Make it available to downstream handlers
  request.requestId = requestId;

  return next();
}
