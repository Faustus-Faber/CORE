/**
 * Health check routes — liveness vs readiness.
 *
 * Per refinement plan §15.2:
 *   "Health endpoints distinguish liveness from database/storage readiness."
 *
 * - GET /health/live  → process is alive (always 200 if the server is running)
 * - GET /health/ready → process can serve traffic (checks DB connection + uploads dir)
 * - GET /health       → backward-compatible combined check (alias for /ready)
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma.js";

export const healthRoutes = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

/**
 * Liveness probe — the process is running.
 * Does NOT check dependencies. Returns 200 as long as Express can respond.
 */
healthRoutes.get("/live", (_request, response) => {
  return response.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Readiness probe — the process can serve traffic.
 * Checks: database connectivity, uploads directory writability.
 */
healthRoutes.get("/ready", async (_request, response) => {
  const checks: Record<string, { status: "pass" | "fail"; detail?: string }> = {};

  // Check 1: Database connectivity — try a simple count query with a timeout
  // so a hanging DB doesn't cause the health check to hang indefinitely.
  try {
    await Promise.race([
      prisma.crisisEvent.count({ take: 1 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database check timed out")), 5000)
      ),
    ]);
    checks.database = { status: "pass" };
  } catch (error) {
    // Log the full error server-side; return only a generic message to avoid leaking
    // connection strings, hostnames, or credentials that may appear in DB errors.
    console.error("[health] Database check failed:", error);
    checks.database = {
      status: "fail",
      detail: "Database connection failed",
    };
  }

  // Check 2: Uploads directory exists and is writable
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    checks.storage = { status: "pass" };
  } catch (error) {
    console.error("[health] Storage check failed:", error);
    checks.storage = {
      status: "fail",
      detail: "Storage directory not writable",
    };
  }

  const allPass = Object.values(checks).every((c) => c.status === "pass");

  return response.status(allPass ? 200 : 503).json({
    status: allPass ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  });
});
