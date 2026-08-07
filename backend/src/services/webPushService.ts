/**
 * Web Push service — browser push notifications via the Web Push API.
 *
 * Per refinement plan §19 "Should have":
 *   "web push if fully implemented"
 *
 * Uses VAPID keys for application identification and the web-push library
 * to send push messages to subscribed browsers.
 *
 * VAPID keys should be generated once and stored in environment variables:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *
 * Generate with: npx web-push generate-vapid-keys
 */

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "../lib/prisma.js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@core.gov.bd";

let configured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

/**
 * Get the VAPID public key for the frontend to use for subscription.
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Check if web push is configured.
 */
export function isWebPushConfigured(): boolean {
  return configured;
}

/**
 * Save a push subscription for a user.
 */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId,
      keys: subscription.keys,
      updatedAt: new Date(),
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
  });
}

/**
 * Remove a push subscription (when user unsubscribes).
 */
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

/**
 * Send a push notification to all of a user's subscribed devices.
 * Returns the number of successful deliveries.
 */
export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<number> {
  if (!configured) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    take: 50,
  });

  if (subscriptions.length === 0) return 0;

  const message = JSON.stringify(payload);

  // Web Push payloads have a hard limit of ~4KB. Skip sending if the payload
  // is too large rather than failing every subscription attempt.
  const MAX_PUSH_PAYLOAD_BYTES = 4096;
  if (Buffer.byteLength(message, "utf8") > MAX_PUSH_PAYLOAD_BYTES) {
    console.warn(`[webpush] Payload too large (${Buffer.byteLength(message, "utf8")} bytes), skipping`);
    return 0;
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSub: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys as { p256dh: string; auth: string },
      };
      await webpush.sendNotification(pushSub, message);
    })
  );

  const successCount = results.filter((r) => r.status === "fulfilled").length;

  // Clean up expired/invalid subscriptions
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const error = result.reason as { statusCode?: number };
      // 404 = subscription expired, 410 = subscription gone
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        const sub = subscriptions[index];
        prisma.pushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => {});
      }
    }
  });

  return successCount;
}
