import type { IncidentType, NotificationType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { generateText } from "./aiService.js";

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
    }
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
  await Promise.all(
    subscriberIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          crisisEventId,
          title,
          body: body.slice(0, 200),
          survivalInstruction,
          type
        }
      })
    )
  );
}

async function safelyGenerateSurvivalInstruction(
  incidentType: string,
  severity: string,
  title: string,
  description: string
): Promise<string | null> {
  try {
    return await generateSurvivalInstruction(incidentType, severity, title, description);
  } catch (error) {
    console.error("Failed to generate survival instruction:", error);
    return null;
  }
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

  await createNotificationsInBulk(
    matchedSubscribers,
    crisisEventId,
    `${severity} ${incidentType.replace(/_/g, " ")} Alert`,
    description,
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

  await createNotificationsInBulk(
    matchedSubscribers,
    crisisEventId,
    `${severity} ${incidentType.replace(/_/g, " ")} Update: ${newStatus.replace(/_/g, " ")}`,
    `${title} — ${updateNote}`,
    null,
    "CRISIS_UPDATE"
  );
}

export async function promptAdminsForNgoReport(
  crisisEventId: string,
  crisisTitle: string,
  resolvedStatus: string
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isBanned: false },
    select: { id: true }
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
