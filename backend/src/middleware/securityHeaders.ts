import type { NextFunction, Request, Response } from "express";

/**
 * Security headers middleware — sets standard HTTP security headers.
 * Equivalent to a subset of helmet's defaults without the external dependency.
 */
export function securityHeaders(request: Request, response: Response, next: NextFunction) {
  // Prevent clickjacking
  response.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Prevent MIME type sniffing
  response.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS protection in older browsers
  response.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy — only send origin for cross-origin requests
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy — restrictive for non-map pages
  // Allow self, inline styles for Tailwind, and data URIs for images
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' https://maps.gstatic.com https://*.googleapis.com data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://api.groq.com https://api.resend.com https://api.ocr.space",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");

  response.setHeader("Content-Security-Policy", csp);

  // X-DNS-Prefetch-Control
  response.setHeader("X-DNS-Prefetch-Control", "off");

  // HSTS — enforce HTTPS in production only
  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // Cache control for API responses
  response.setHeader("Cache-Control", "no-store");

  return next();
}
