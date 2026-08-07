import type { NextFunction, Request, Response } from "express";
import { logAuditEvent } from "../services/auditService.js";

/**
 * FR-15: Audit middleware that automatically logs state-changing requests.
 * Attaches to routes that perform POST/PATCH/DELETE operations.
 */
export function auditLog(action: string, targetType: string) {
  return async (request: Request, response: Response, next: NextFunction) => {
    // Store the original send method to capture the response
    const originalSend = response.send;
    let responseBody: unknown;

    response.send = function (body: unknown) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Continue to the route handler
    next();

    // After response is sent, log the audit event if successful
    response.on("finish", () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const targetId = (request.params.id as string) ?? (request.params.reportId as string) ??
                         (request.params.crisisId as string) ?? (request.params.allocationId as string);

        logAuditEvent({
          actorId: request.authUser?.userId,
          action,
          targetType,
          targetId,
          requestId: request.requestId,
        }).catch((err) => {
          // Non-critical — audit logging should not block responses, but log to stderr
          // so operators can detect when the audit system is broken.
          console.error(
            `[audit] Failed to log ${action} event:`,
            err instanceof Error ? err.message : String(err)
          );
        });
      }
    });
  };
}
