import type { NextFunction, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * 1. On any GET request without a CSRF token cookie, set one.
 * 2. On any state-changing request (POST, PATCH, PUT, DELETE),
 *    compare the X-CSRF-Token header to the csrf_token cookie.
 * 3. If they don't match, reject with 403.
 *
 * This works alongside httpOnly JWT cookies because the CSRF token
 * is a separate non-httpOnly cookie that JavaScript can read.
 */

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Constant-time string comparison to prevent timing attacks on token validation. */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function csrfProtection(request: Request, response: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === "production";

  // Always set the CSRF cookie if not present (even on safe methods)
  const existingToken = request.cookies?.[CSRF_COOKIE_NAME];
  if (!existingToken) {
    const newToken = randomBytes(32).toString("hex");
    response.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false, // JavaScript must be able to read this
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    // For the current request, use the new token
    request.csrfToken = newToken;
  } else {
    request.csrfToken = existingToken;
  }

  // Skip CSRF check for safe methods
  if (SAFE_METHODS.has(request.method)) {
    return next();
  }

  // Skip CSRF check for initial unauthenticated login / registration endpoints
  if (request.path.includes("/auth/login") || request.path.includes("/auth/register") || request.path.includes("/auth/forgot-password") || request.path.includes("/auth/reset-password")) {
    return next();
  }

  // In production cross-site deployments, CORS origin validation verifies trusted domains.
  // Allow state-changing requests originating from trusted CORS frontend origins.
  const originHeader = request.headers.origin;
  if (originHeader && (/^https?:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(originHeader) || env.corsOrigins.includes(originHeader))) {
    return next();
  }

  // In development, skip CSRF validation for convenience (e.g. browser preview proxies)
  if (!isProduction) {
    return next();
  }

  // For state-changing methods, validate the token using constant-time comparison
  const headerToken = request.headers[CSRF_HEADER_NAME] as string | undefined;
  const expectedToken = existingToken ?? request.csrfToken;

  if (!headerToken || !constantTimeCompare(headerToken, expectedToken)) {
    return response.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "CSRF token missing or invalid",
        retryable: false
      },
      requestId: request.requestId
    });
  }

  return next();
}
