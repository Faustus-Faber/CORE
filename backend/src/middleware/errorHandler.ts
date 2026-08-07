import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { SafeError } from "../utils/SafeError.js";

/**
 * Central error handler — produces safe, structured error responses.
 * Never exposes internal error details (stack traces, database errors) to clients.
 * Always includes a request ID for debugging.
 */
export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const requestId = request.requestId ?? request.headers["x-request-id"] ?? "unknown";

  if (error instanceof ZodError) {
    return response.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      requestId
    });
  }

  // SafeError: messages are explicitly marked safe for client exposure
  // (e.g. "Resource not found", "Invalid credentials", "Quantity cannot be negative")
  if (error instanceof SafeError) {
    return response.status(error.statusCode).json({
      error: {
        code: error.statusCode >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST",
        message: error.message,
        retryable: error.statusCode >= 500
      },
      requestId
    });
  }

  // Any other Error is treated as an unexpected internal error.
  // Log the full details server-side, return a generic message to the client.
  if (error instanceof Error) {
    console.error(`[${requestId}] Unhandled error:`, error.message, error.stack);
    return response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        retryable: true
      },
      requestId
    });
  }

  console.error(`[${requestId}] Unexpected server error:`, error);
  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again later.",
      retryable: true
    },
    requestId
  });
}
