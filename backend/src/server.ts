import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { expireReservations } from "./services/resourceService.js";
import { processOutboxJobs } from "./services/outboxService.js";
import { expireStaleOffers } from "./services/assignmentService.js";
import { cleanupRateLimiter } from "./middleware/rateLimiter.js";
import { syncAllTrustTiers } from "./services/trustTierService.js";

const server = app.listen(env.port, () => {
  console.log(`CORE backend listening on http://localhost:${env.port}`);

  // Sync trust tiers on startup — fixes seed data disconnect where
  // volunteers had points but no tier assigned
  syncAllTrustTiers().catch((err) => {
    console.error("[startup] Failed to sync trust tiers:", err);
  });
});

// P0-13: Periodic reservation expiry scheduler
// Runs every 15 minutes to expire approved reservations past their pickup window
const EXPIRY_INTERVAL_MS = 15 * 60 * 1000;
let expiryRunning = false;
const expiryTimer = setInterval(async () => {
  if (expiryRunning) return; // Prevent overlapping runs
  expiryRunning = true;
  try {
    const result = await expireReservations();
    if (result.count > 0) {
      console.log(`[SCHEDULER] Expired ${result.count} reservation(s)`);
    }
  } catch (error) {
    console.error("[SCHEDULER] Reservation expiry failed:", error);
  } finally {
    expiryRunning = false;
  }
}, EXPIRY_INTERVAL_MS);

// Outbox worker — processes pending outbox jobs every 5 seconds
const OUTBOX_INTERVAL_MS = 5 * 1000;
let outboxRunning = false;
const outboxTimer = setInterval(async () => {
  if (outboxRunning) return; // Prevent overlapping runs
  outboxRunning = true;
  try {
    const result = await processOutboxJobs();
    if (result.processed > 0 || result.failed > 0) {
      console.log(`[OUTBOX] Processed: ${result.processed}, Failed: ${result.failed}`);
    }
  } catch (error) {
    console.error("[OUTBOX] Worker failed:", error);
  } finally {
    outboxRunning = false;
  }
}, OUTBOX_INTERVAL_MS);

// Assignment expiry scheduler — expires stale OFFERED assignments older than 24h
const ASSIGNMENT_EXPIRY_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
let assignmentExpiryRunning = false;
const assignmentExpiryTimer = setInterval(async () => {
  if (assignmentExpiryRunning) return;
  assignmentExpiryRunning = true;
  try {
    const count = await expireStaleOffers();
    if (count > 0) {
      console.log(`[SCHEDULER] Expired ${count} stale assignment offer(s)`);
    }
  } catch (error) {
    console.error("[SCHEDULER] Assignment expiry failed:", error);
  } finally {
    assignmentExpiryRunning = false;
  }
}, ASSIGNMENT_EXPIRY_INTERVAL_MS);

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${env.port} is already in use. Stop the existing backend process or change PORT in backend/.env.`
    );
    process.exit(1);
  }

  throw error;
});

// Graceful shutdown
async function shutdown() {
  clearInterval(expiryTimer);
  clearInterval(outboxTimer);
  clearInterval(assignmentExpiryTimer);
  cleanupRateLimiter();
  server.close(async () => {
    console.log("Server closed");
    try {
      await prisma.$disconnect();
      console.log("Database disconnected");
    } catch (err) {
      console.error("Error disconnecting database:", err);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
