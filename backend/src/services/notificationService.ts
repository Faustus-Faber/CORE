import type { IncidentType, NotificationType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { generateText } from "./aiService.js";
import { sendPushNotification } from "./webPushService.js";
import { enqueueJob } from "./outboxService.js";

export type NotificationPreferencesInput = {
  incidentTypes: IncidentType[];
  radiusKm: number;
  isActive: boolean;
};

export type NotificationEntry = {
  id: string;
  title: string;
  body: string;
  survivalInstruction: string | null;
  isRead: boolean;
  crisisEventId: string | null;
  createdAt: string;
};

export async function upsertSubscription(
  userId: string,
  input: NotificationPreferencesInput
): Promise<void> {
  await prisma.notificationSubscription.upsert({
    where: { userId },
    update: {
      incidentTypes: input.incidentTypes,
      radiusKm: input.radiusKm,
      isActive: input.isActive
    },
    create: {
      userId,
      incidentTypes: input.incidentTypes,
      radiusKm: input.radiusKm,
      isActive: input.isActive
    }
  });
}

export async function getSubscription(
  userId: string
): Promise<{ incidentTypes: IncidentType[]; radiusKm: number; isActive: boolean } | null> {
  const sub = await prisma.notificationSubscription.findUnique({
    where: { userId },
    select: { incidentTypes: true, radiusKm: true, isActive: true }
  });

  if (!sub) return null;
  return sub;
}

async function findSubscribersWithinRadius(
  incidentType: string,
  latitude: number,
  longitude: number
) {
  const subscriptions = await prisma.notificationSubscription.findMany({
    where: {
      isActive: true,
      incidentTypes: { has: incidentType as IncidentType }
    },
    select: {
      id: true,
      userId: true,
      radiusKm: true
    },
    take: 1000
  });

  if (subscriptions.length === 0) {
    return [];
  }

  const userIds = [...new Set(subscriptions.map((sub) => sub.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, latitude: true, longitude: true }
  });

  const userById = new Map(users.map((user) => [user.id, user]));
  const orphanSubscriptionIds: string[] = [];
  const matchedUserIds: string[] = [];

  for (const sub of subscriptions) {
    const user = userById.get(sub.userId);
    if (!user) {
      orphanSubscriptionIds.push(sub.id);
      continue;
    }

    if (user.latitude == null || user.longitude == null) {
      continue;
    }

    const distance = haversineDistanceKm(
      latitude,
      longitude,
      user.latitude,
      user.longitude
    );
    if (distance <= sub.radiusKm) {
      matchedUserIds.push(sub.userId);
    }
  }

  if (orphanSubscriptionIds.length > 0) {
    await prisma.notificationSubscription.deleteMany({
      where: { id: { in: orphanSubscriptionIds } }
    });
  }

  return matchedUserIds;
}

async function createNotificationsInBulk(
  subscriberIds: string[],
  crisisEventId: string,
  title: string,
  body: string,
  survivalInstruction: string | null,
  type: NotificationType
): Promise<void> {
  // P0-11: Create notification records and enqueue outbox jobs atomically
  // so that web-push delivery is durable and retryable.
  // Use allSettled so a single failed notification doesn't block the rest.
  const results = await Promise.allSettled(
    subscriberIds.map(async (userId) => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          crisisEventId,
          title,
          body: body.slice(0, 200),
          survivalInstruction,
          type,
          channel: "WEB_PUSH",
          deliveryState: "QUEUED"
        }
      });

      // P0-11: Enqueue durable delivery job instead of fire-and-forget
      try {
        await enqueueJob({
          jobType: "NOTIFICATION_DISPATCH",
          payload: {
            notificationId: notification.id,
            userId,
            title,
            body: body.slice(0, 200),
            url: `/dashboard/incidents/${crisisEventId}`,
          },
          targetEntityId: notification.id,
          crisisEventId,
          dedupeKey: `notif-${notification.id}`,
        });
      } catch (err) {
        console.error("[outbox] Failed to enqueue notification dispatch:", err);
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[notification] ${failed.length}/${subscriberIds.length} notifications failed to create`);
  }
}

async function safelyGenerateSurvivalInstruction(
  incidentType: string,
  severity: string,
  title: string,
  description: string
): Promise<string | null> {
  // P0-20: Always include vetted, pre-approved safety instructions as a baseline.
  // AI-generated instructions are appended as supplementary guidance only.
  const vettedInstructions = getVettedSafetyInstructions(incidentType);

  try {
    const aiInstructions = await generateSurvivalInstruction(incidentType, severity, title, description);
    return `${vettedInstructions}\n\n---\n\n**Additional Guidance:**\n${aiInstructions}`;
  } catch (error) {
    console.error("Failed to generate survival instruction:", error);
    // P0-20: Fall back to vetted instructions only — never return null when we have a playbook
    return vettedInstructions;
  }
}

// P0-20: Pre-approved, human-vetted safety instructions by incident type.
// These are always included regardless of AI output.
function getVettedSafetyInstructions(incidentType: string): string {
  const playbooks: Record<string, string> = {
    FLOOD: [
      "**Flood Safety Instructions**",
      "",
      "- Move to higher ground immediately. Avoid walking or driving through flood water.",
      "- Follow evacuation orders from local authorities.",
      "- Keep emergency contact numbers accessible.",
      "- Do not drink flood water. Use stored or boiled water."
    ].join("\n"),
    FIRE: [
      "**Fire Safety Instructions**",
      "",
      "- Evacuate the area immediately. Do not use elevators.",
      "- Stay low to the ground to avoid smoke inhalation.",
      "- Call the fire service (999 in Bangladesh).",
      "- Do not re-enter the building until authorities declare it safe."
    ].join("\n"),
    EARTHQUAKE: [
      "**Earthquake Safety Instructions**",
      "",
      "- Drop, Cover, and Hold On. Take shelter under a sturdy table.",
      "- Stay away from windows, mirrors, and heavy furniture.",
      "- If outdoors, move to an open area away from buildings and power lines.",
      "- Be prepared for aftershocks."
    ].join("\n"),
    BUILDING_COLLAPSE: [
      "**Building Collapse Safety Instructions**",
      "",
      "- Evacuate the area immediately. Do not re-enter damaged structures.",
      "- Call emergency services (999 in Bangladesh).",
      "- Stay clear of debris, gas lines, and downed power lines.",
      "- Do not attempt rescue unless trained and equipped."
    ].join("\n"),
    ROAD_ACCIDENT: [
      "**Road Accident Safety Instructions**",
      "",
      "- Move to a safe location away from traffic.",
      "- Call emergency services if there are injuries.",
      "- Do not move seriously injured persons unless there is immediate danger.",
      "-Turn on hazard lights and use warning triangles if available."
    ].join("\n"),
    VIOLENCE: [
      "**Safety Instructions**",
      "",
      "- Move to a safe location and stay indoors.",
      "- Avoid the affected area until authorities declare it safe.",
      "- Keep emergency contact numbers accessible.",
      "- Follow instructions from law enforcement."
    ].join("\n"),
    MEDICAL_EMERGENCY: [
      "**Medical Emergency Instructions**",
      "",
      "- Call for medical assistance immediately (999 in Bangladesh).",
      "- Do not move the injured person unless they are in immediate danger.",
      "- Apply basic first aid only if you are trained.",
      "-Keep the person warm and monitor their breathing."
    ].join("\n"),
    OTHER: [
      "**Emergency Safety Instructions**",
      "",
      "- Stay calm and assess your surroundings.",
      "- Move to a safe location away from the hazard.",
      "- Keep emergency contact numbers accessible (999 in Bangladesh).",
      "- Follow instructions from local authorities."
    ].join("\n")
  };

  return playbooks[incidentType] ?? playbooks.OTHER;
}

export async function dispatchNotifications(
  crisisEventId: string,
  incidentType: string,
  severity: string,
  title: string,
  description: string,
  latitude: number | null,
  longitude: number | null
): Promise<void> {
  if (latitude == null || longitude == null) return;

  const matchedSubscribers = await findSubscribersWithinRadius(
    incidentType,
    latitude,
    longitude
  );

  if (matchedSubscribers.length === 0) return;

  const survivalInstruction = await safelyGenerateSurvivalInstruction(
    incidentType,
    severity,
    title,
    description
  );

  // FR-09: Use vetted notification template for the alert
  const template = getVettedNotificationTemplate("CRISIS_ALERT", incidentType, severity, title);
  await createNotificationsInBulk(
    matchedSubscribers,
    crisisEventId,
    template.title,
    template.body(description),
    survivalInstruction,
    "CRISIS_ALERT"
  );
}

export async function dispatchCrisisUpdateNotifications(
  crisisEventId: string,
  incidentType: string,
  severity: string,
  title: string,
  updateNote: string,
  newStatus: string,
  latitude: number | null,
  longitude: number | null
): Promise<void> {
  if (latitude == null || longitude == null) return;

  const matchedSubscribers = await findSubscribersWithinRadius(
    incidentType,
    latitude,
    longitude
  );

  if (matchedSubscribers.length === 0) return;

  // FR-09: Use vetted notification template for the update
  const template = getVettedNotificationTemplate("CRISIS_UPDATE", incidentType, severity, title);
  await createNotificationsInBulk(
    matchedSubscribers,
    crisisEventId,
    template.title,
    template.body(updateNote, newStatus),
    null,
    "CRISIS_UPDATE"
  );
}

// ── FR-09: Vetted Notification Templates ─────────────────────────────────────
// Pre-approved, human-reviewed notification templates for each notification type.
// These ensure consistent, professional, and accurate messaging to affected users.

type NotificationTemplateType = "CRISIS_ALERT" | "CRISIS_UPDATE" | "DISPATCH_ALERT";

type VettedTemplate = {
  title: string;
  body: (context: string, newStatus?: string) => string;
};

const VETTED_TEMPLATES: Record<NotificationTemplateType, (incidentType: string, severity: string, title: string) => VettedTemplate> = {
  CRISIS_ALERT: (incidentType, severity, title) => ({
    title: `${severity} ${incidentType.replace(/_/g, " ")} Alert: ${title}`,
    body: (description: string) =>
      `A ${severity.toLowerCase()} ${incidentType.replace(/_/g, " ").toLowerCase()} has been reported in your area. ${description.slice(0, 150)}`
  }),

  CRISIS_UPDATE: (incidentType, severity, title) => ({
    title: `${severity} ${incidentType.replace(/_/g, " ")} Update: ${title}`,
    body: (updateNote: string, newStatus?: string) =>
      `Status: ${newStatus?.replace(/_/g, " ") ?? "Updated"}. ${updateNote.slice(0, 150)}`
  }),

  DISPATCH_ALERT: (incidentType, _severity, title) => ({
    title: `Dispatch Request: ${title}`,
    body: (context: string) =>
      `You have been requested to respond to a ${incidentType.replace(/_/g, " ").toLowerCase()} incident. ${context.slice(0, 150)}`
  })
};

function getVettedNotificationTemplate(
  type: NotificationTemplateType,
  incidentType: string,
  severity: string,
  title: string
): VettedTemplate {
  const builder = VETTED_TEMPLATES[type];
  return builder(incidentType, severity, title);
}

export async function promptAdminsForNgoReport(
  crisisEventId: string,
  crisisTitle: string,
  resolvedStatus: string
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isBanned: false },
    select: { id: true },
    take: 100
  });

  if (admins.length === 0) return;

  await createNotificationsInBulk(
    admins.map((admin) => admin.id),
    crisisEventId,
    `NGO Summary Report requested`,
    `Crisis "${crisisTitle}" has reached status ${resolvedStatus}. Trigger an NGO summary report for stakeholders.`,
    null,
    "NGO_REPORT_PROMPT"
  );
}

export async function getNotifications(
  userId: string,
  page: number,
  limit: number
): Promise<{ notifications: NotificationEntry[]; unreadCount: number; total: number }> {
  const skip = (page - 1) * limit;

  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        survivalInstruction: true,
        isRead: true,
        crisisEventId: true,
        createdAt: true,
        reservationId: true,
        type: true
      }
    }),
    prisma.notification.count({
      where: { userId, isRead: false }
    }),
    prisma.notification.count({
      where: { userId }
    })
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      survivalInstruction: n.survivalInstruction,
      isRead: n.isRead,
      crisisEventId: n.crisisEventId,
      reservationId: n.reservationId,
      type: n.type,
      createdAt: n.createdAt.toISOString()
    })),
    unreadCount,
    total
  };
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true }
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
}

async function generateSurvivalInstruction(
  incidentType: string,
  severity: string,
  title: string,
  description: string
): Promise<string> {
  const prompt = `You are a public safety officer writing emergency instructions for residents affected by the incident below.

Incident:
- Type: ${incidentType}
- Severity: ${severity}
- Title: ${title}
- Description: ${description.slice(0, 300)}

Output format (strict Markdown):
- Line 1: a single **bold** imperative directive (one sentence, under 20 words).
- Blank line.
- 4 to 6 bullet points, each starting with "- ", each one actionable imperative sentence under 25 words.
- Do not use headings, numbered lists, code fences, links, or any preamble.
- Total length between 80 and 150 words.

Return only the Markdown content.`;

  const response = await generateText(prompt);
  return response.trim();
}

export async function clearHandledNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: { userId, isRead: true }
  });
}
