import { prisma } from "../lib/prisma.js";
import type { OutboxJobType } from "@prisma/client";

/**
 * Enqueue a job in the transactional outbox.
 * Call this inside a Prisma transaction to ensure the job is committed
 * atomically with the main operation.
 */
export async function enqueueJob(params: {
  jobType: OutboxJobType;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  targetEntityId?: string;
  crisisEventId?: string;
  actorId?: string;
  availableAt?: Date;
}): Promise<void> {
  // If a dedupeKey is provided, skip creating a duplicate job if an active or
  // completed job with the same key already exists. This prevents duplicate
  // notifications and other side effects when operations are retried.
  if (params.dedupeKey) {
    const existing = await prisma.outboxJob.findFirst({
      where: {
        dedupeKey: params.dedupeKey,
        state: { in: ["PENDING", "PROCESSING", "COMPLETED"] }
      },
      select: { id: true }
    });

    if (existing) {
      console.log(`[outbox] Skipping duplicate job with dedupeKey: ${params.dedupeKey}`);
      return;
    }
  }

  await prisma.outboxJob.create({
    data: {
      jobType: params.jobType,
      state: "PENDING",
      payloadJson: JSON.stringify(params.payload),
      dedupeKey: params.dedupeKey,
      targetEntityId: params.targetEntityId,
      crisisEventId: params.crisisEventId,
      actorId: params.actorId,
      availableAt: params.availableAt ?? new Date(),
    },
  });
}

/**
 * Claim and process pending outbox jobs.
 * Called by the background worker on an interval.
 */
export async function processOutboxJobs(maxBatch = 10): Promise<{ processed: number; failed: number }> {
  // Reclaim stale PROCESSING jobs (crashed workers) — locked more than 5 minutes ago
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.outboxJob.updateMany({
    where: { state: "PROCESSING", lockedAt: { lt: staleThreshold } },
    data: { state: "PENDING", lockedAt: null },
  });

  // Find pending jobs that are available now
  const jobs = await prisma.outboxJob.findMany({
    where: {
      state: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: maxBatch,
  });

  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    // Try to atomically claim the job by setting state to PROCESSING
    try {
      const claimed = await prisma.outboxJob.updateMany({
        where: { id: job.id, state: "PENDING" },
        data: { state: "PROCESSING", lockedAt: new Date() },
      });

      if (claimed.count === 0) {
        // Someone else claimed it
        continue;
      }

      await executeJob(job);
      await prisma.outboxJob.update({
        where: { id: job.id },
        data: { state: "COMPLETED", completedAt: new Date() },
      });
      processed++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempts >= job.maxAttempts) {
        await prisma.outboxJob.update({
          where: { id: job.id },
          data: { state: "DEAD_LETTER", attempts, lastError: errorMessage },
        });
      } else {
        // Exponential backoff: 2^attempts seconds, capped at 1 hour
        const backoffMs = Math.min(Math.pow(2, attempts) * 1000, 60 * 60 * 1000);
        await prisma.outboxJob.update({
          where: { id: job.id },
          data: {
            state: "PENDING",
            attempts,
            lastError: errorMessage,
            availableAt: new Date(Date.now() + backoffMs),
            lockedAt: null,
          },
        });
      }
      failed++;
    }
  }

  return { processed, failed };
}

async function executeJob(job: { id: string; jobType: string; payloadJson: string }): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(job.payloadJson);
  } catch {
    throw new Error(`Failed to parse payload JSON for outbox job ${job.id}`);
  }

  switch (job.jobType) {
    case "NOTIFICATION_DISPATCH":
      await processNotificationDispatch(payload);
      break;
    case "AI_TRIAGE":
      // AI triage is handled by the existing report service asynchronously
      // This just marks it as ready for the report service to pick up
      break;
    case "PDF_GENERATION":
      // PDF generation is handled by the NGO report service
      break;
    case "RESERVATION_EXPIRY":
      // Handled by existing scheduler
      break;
    default: {
      // Unknown job type - throw to mark as FAILED instead of silently completing
      throw new Error(`Unknown outbox job type: ${job.jobType}`);
    }
  }
}

async function processNotificationDispatch(payload: Record<string, unknown>): Promise<void> {
  const { notificationId, userId, title, body, url } = payload;
  if (!notificationId || !userId) return;

  // P0-11: Send web push notification durably via outbox
  if (typeof title === "string" && typeof body === "string") {
    try {
      const { sendPushNotification } = await import("./webPushService.js");
      await sendPushNotification(userId as string, {
        title: title as string,
        body: body as string,
        url: (url as string) ?? `/dashboard`,
      });
    } catch (err) {
      console.error("[outbox] Web push delivery failed:", err);
      // Re-throw so the outbox retries with backoff
      throw err;
    }
  }

  // Update notification delivery state
  await prisma.notification.update({
    where: { id: notificationId as string },
    data: { deliveryState: "SENT", attemptCount: { increment: 1 } },
  }).catch(() => {
    // Non-critical - notification may have been deleted
  });
}

/**
 * Get outbox job statistics for monitoring.
 */
export async function getOutboxStats() {
  const [pending, processing, failed, deadLetter] = await Promise.all([
    prisma.outboxJob.count({ where: { state: "PENDING" } }),
    prisma.outboxJob.count({ where: { state: "PROCESSING" } }),
    prisma.outboxJob.count({ where: { state: "FAILED" } }),
    prisma.outboxJob.count({ where: { state: "DEAD_LETTER" } }),
  ]);

  return { pending, processing, failed, deadLetter };
}
