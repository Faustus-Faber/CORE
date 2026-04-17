import type { IncidentType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
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

export async function dispatchNotifications(
  crisisEventId: string,
  incidentType: string,
  severity: string,
  title: string,
  description: string,
  latitude: number | null,
  longitude: number | null
): Promise<void> {
  const subscribers = await prisma.notificationSubscription.findMany({
    where: {
      isActive: true,
      incidentTypes: { has: incidentType as IncidentType }
    },
    include: {
      user: { select: { id: true, fullName: true, location: true, latitude: true, longitude: true } }
    }
  });

  for (const sub of subscribers) {
    if (
      latitude != null &&
      longitude != null &&
      sub.user.latitude != null &&
      sub.user.longitude != null
    ) {
      const distance = haversineDistanceKm(
        latitude,
        longitude,
        sub.user.latitude,
        sub.user.longitude
      );
      if (distance > sub.radiusKm) continue;
    }

    let survivalInstruction: string | null = null;
    try {
      survivalInstruction = await generateSurvivalInstruction(
        incidentType,
        severity,
        title,
        description
      );
    } catch {
      survivalInstruction = null;
    }

    await prisma.notification.create({
      data: {
        userId: sub.userId,
        crisisEventId,
        title: `${severity} ${incidentType.replace(/_/g, " ")} Alert`,
        body: description.slice(0, 200),
        survivalInstruction,
        type: "CRISIS_ALERT"
      }
    });
  }
}

export async function getNotifications(
  userId: string,
  page: number,
  limit: number
): Promise<{ notifications: NotificationEntry[]; unreadCount: number }> {
  const skip = (page - 1) * limit;

  const [notifications, unreadCount] = await Promise.all([
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
    unreadCount
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
  const prompt = `Generate a concise survival instruction (50-150 words) for this emergency:

Type: ${incidentType}
Severity: ${severity}
Title: ${title}
Description: ${description.slice(0, 300)}

Provide only actionable safety advice. No preamble.`;

  const response = await generateText(prompt);
  return response.trim();
}

export async function clearHandledNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: {
      userId,
      type: {
        in: ["RESERVATION_APPROVED", "RESERVATION_DECLINED"]
      }
    }
  });
}