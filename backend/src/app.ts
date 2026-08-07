import path from "node:path";
import fs from "node:fs";

import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { authRateLimiter, apiRateLimiter } from "./middleware/rateLimiter.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { latencyGuard } from "./middleware/latencyGuard.js";
import { csrfProtection } from "./middleware/csrf.js";
import { requireAuth } from "./middleware/auth.js";
import { apiRoutes } from "./routes/index.js";

export const app = express();

// Trust the first proxy hop so request.ip reflects the real client IP
// (from X-Forwarded-For set by nginx/load balancer) instead of the proxy IP.
// This is required for rate limiting to work correctly behind a reverse proxy.
app.set("trust proxy", 1);

// P1: Add request IDs for tracing
app.use(requestIdMiddleware);

// §15.4: Structured request logging with latency metrics
app.use(requestLogger);

// §15.1: Latency enforcement — alerts on p95 SLO violations (does not reject)
app.use(latencyGuard);

// P1: Security headers
app.use(securityHeaders);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, server-to-server, mobile apps)
      if (!origin) {
        callback(null, true);
        return;
      }

      // In development, allow any localhost/127.0.0.1 origin
      if (process.env.NODE_ENV !== "production") {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          callback(null, true);
          return;
        }
      }

      // Allow any Render subdomain (*.onrender.com) automatically
      if (/^https?:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) {
        callback(null, true);
        return;
      }

      // Check against configured allowed origins
      if (env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// P1: CSRF protection (double-submit cookie pattern)
app.use(csrfProtection);

// P0-02: Private uploads — authenticated download route instead of public static serving
// Supports both /uploads/:subdir/:filename and /uploads/:filename (legacy root-level files)
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

app.get("/uploads/:subdir/:filename", requireAuth, (request, response) => {
  const subdir = String(request.params.subdir);
  const filename = String(request.params.filename);

  // Prevent path traversal: only allow known subdirectories
  const allowedSubdirs = ["reports", "evidence", "ocr", "docs", "voice", "resources"];
  if (!allowedSubdirs.includes(subdir)) {
    return response.status(404).json({ message: "Not found" });
  }

  // Prevent path traversal in filename
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return response.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.join(UPLOADS_ROOT, subdir, filename);
  if (!filePath.startsWith(UPLOADS_ROOT)) {
    return response.status(400).json({ message: "Invalid path" });
  }

  if (!fs.existsSync(filePath)) {
    return response.status(404).json({ message: "File not found" });
  }

  return response.sendFile(filePath);
});

// Legacy root-level uploads (doc files, resource photos, timesheet evidence)
app.get("/uploads/:filename", requireAuth, (request, response) => {
  const filename = String(request.params.filename);

  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return response.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.join(UPLOADS_ROOT, filename);
  if (!filePath.startsWith(UPLOADS_ROOT)) {
    return response.status(400).json({ message: "Invalid path" });
  }

  if (!fs.existsSync(filePath)) {
    return response.status(404).json({ message: "File not found" });
  }

  return response.sendFile(filePath);
});

// Public shared file access — validates a share token before serving the file
app.get("/shared-files/:token/:filename", async (request, response) => {
  const { token, filename } = request.params;

  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return response.status(400).json({ message: "Invalid filename" });
  }

  try {
    const { prisma } = await import("./lib/prisma.js");
    const link = await prisma.shareLink.findFirst({
      where: {
        token,
        isRevoked: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      include: { folder: { select: { isDeleted: true } } }
    });

    if (!link || link.folder?.isDeleted) {
      return response.status(404).json({ message: "Shared link not found or expired" });
    }

    // Try both root-level and docs subdirectory
    const candidates = [
      path.join(UPLOADS_ROOT, filename),
      path.join(UPLOADS_ROOT, "docs", filename)
    ];

    for (const candidate of candidates) {
      if (candidate.startsWith(UPLOADS_ROOT) && fs.existsSync(candidate)) {
        return response.sendFile(candidate);
      }
    }

    return response.status(404).json({ message: "File not found" });
  } catch {
    return response.status(500).json({ message: "Server error" });
  }
});

app.get("/", (_request, response) => {
  response.status(200).json({
    message: "CORE API running",
    docs: "/api/health"
  });
});

app.use("/api", apiRoutes);
app.use(errorHandler);
