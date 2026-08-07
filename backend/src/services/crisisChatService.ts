/**
 * Crisis Chat Service
 *
 * Async message board scoped to a crisis event.
 * Volunteers who opted in + admins can send messages.
 * Messages are persisted and pushed via SSE.
 */

import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";
import { publishCrisisChatMessage, type CrisisChatEvent } from "../lib/crisisChatStream.js";

export type CrisisMessageDTO = {
  id: string;
  crisisEventId: string;
  senderId: string;
  senderName: string;
  senderTrustTier: string;
  senderRole: string;
  content: string;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: string;
};

const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 50;

function toDTO(
  msg: {
    id: string;
    crisisEventId: string;
    senderId: string;
    content: string;
    isPinned: boolean;
    isDeleted: boolean;
    createdAt: Date;
    sender: { fullName: string; trustTier: string; role: string };
  }
): CrisisMessageDTO {
  return {
    id: msg.id,
    crisisEventId: msg.crisisEventId,
    senderId: msg.senderId,
    senderName: msg.sender.fullName,
    senderTrustTier: msg.sender.trustTier,
    senderRole: msg.sender.role,
    content: msg.content,
    isPinned: msg.isPinned,
    isDeleted: msg.isDeleted,
    createdAt: msg.createdAt.toISOString(),
  };
}

/**
 * List messages for a crisis event (paginated, oldest first).
 */
export async function listCrisisMessages(
  crisisEventId: string,
  page = 1,
  limit = PAGE_SIZE
): Promise<{ messages: CrisisMessageDTO[]; total: number }> {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safeLimit;

  const [messages, total] = await Promise.all([
    prisma.crisisMessage.findMany({
      where: { crisisEventId },
      orderBy: { createdAt: "desc" },
      skip,
      take: safeLimit,
      select: {
        id: true,
        crisisEventId: true,
        senderId: true,
        content: true,
        isPinned: true,
        isDeleted: true,
        createdAt: true,
        sender: {
          select: { fullName: true, trustTier: true, role: true },
        },
      },
    }),
    prisma.crisisMessage.count({ where: { crisisEventId } }),
  ]);

  // Reverse so oldest is first (natural chat order)
  return {
    messages: messages.reverse().map(toDTO),
    total,
  };
}

/**
 * Create a new chat message in a crisis room.
 * Only volunteers who opted in to the crisis OR admins can send messages.
 */
export async function createCrisisMessage(
  crisisEventId: string,
  senderId: string,
  content: string
): Promise<CrisisMessageDTO> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new SafeError("Message cannot be empty", 400);
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new SafeError(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`, 400);
  }

  // Verify the crisis event exists
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true, status: true, title: true },
  });
  if (!crisis) {
    throw new SafeError("Crisis event not found", 404);
  }

  // Verify sender exists and is authorized
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, role: true, fullName: true, trustTier: true, isBanned: true },
  });
  if (!sender || sender.isBanned) {
    throw new SafeError("Sender not authorized", 403);
  }

  // Admins can always send messages
  // Volunteers must have opted in to the crisis (have a CrisisResponder record)
  if (sender.role === "VOLUNTEER") {
    const responder = await prisma.crisisResponder.findUnique({
      where: {
        crisisEventId_volunteerId: { crisisEventId, volunteerId: senderId },
      },
      select: { status: true },
    });
    if (!responder) {
      throw new SafeError("You must opt in to this crisis before sending messages", 403);
    }
  } else if (sender.role !== "ADMIN") {
    throw new SafeError("Only volunteers and admins can send messages", 403);
  }

  const message = await prisma.crisisMessage.create({
    data: {
      crisisEventId,
      senderId,
      content: trimmed,
    },
    select: {
      id: true,
      crisisEventId: true,
      senderId: true,
      content: true,
      isPinned: true,
      isDeleted: true,
      createdAt: true,
      sender: {
        select: { fullName: true, trustTier: true, role: true },
      },
    },
  });

  const dto = toDTO(message);

  // Publish to SSE stream
  const event: CrisisChatEvent = {
    id: dto.id,
    crisisEventId: dto.crisisEventId,
    senderId: dto.senderId,
    senderName: dto.senderName,
    senderTrustTier: dto.senderTrustTier,
    senderRole: dto.senderRole,
    content: dto.content,
    createdAt: dto.createdAt,
  };
  publishCrisisChatMessage(event);

  // Notify all opted-in volunteers + admins (except the sender)
  try {
    const [responders, admins] = await Promise.all([
      prisma.crisisResponder.findMany({
        where: { crisisEventId },
        select: { volunteerId: true },
      }),
      prisma.user.findMany({
        where: { role: "ADMIN", isBanned: false },
        select: { id: true },
      }),
    ]);

    const recipientIds = new Set<string>();
    for (const r of responders) recipientIds.add(r.volunteerId);
    for (const a of admins) recipientIds.add(a.id);
    // Don't notify the sender
    recipientIds.delete(senderId);

    const preview = trimmed.length > 80 ? trimmed.slice(0, 80) + "..." : trimmed;

    if (recipientIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipientIds).map((userId) => ({
          userId,
          title: `New message in ${crisis.title}`,
          body: `${sender.fullName}: ${preview}`,
          type: "CHAT_MESSAGE" as const,
          crisisEventId,
        })),
      });
    }
  } catch (err) {
    console.error("[crisis-chat] Failed to send notifications:", err);
  }

  return dto;
}

/**
 * Soft-delete a message (admin only).
 */
export async function deleteCrisisMessage(
  messageId: string,
  deletedById: string
): Promise<void> {
  const message = await prisma.crisisMessage.findUnique({
    where: { id: messageId },
    select: { id: true, isDeleted: true },
  });
  if (!message) {
    throw new SafeError("Message not found", 404);
  }
  if (message.isDeleted) {
    return; // idempotent
  }

  await prisma.crisisMessage.update({
    where: { id: messageId },
    data: {
      isDeleted: true,
      deletedById,
      deletedAt: new Date(),
    },
  });
}

/**
 * Toggle pin status on a message (admin only).
 */
export async function togglePinCrisisMessage(
  messageId: string
): Promise<{ isPinned: boolean }> {
  const message = await prisma.crisisMessage.findUnique({
    where: { id: messageId },
    select: { id: true, isPinned: true },
  });
  if (!message) {
    throw new SafeError("Message not found", 404);
  }

  const updated = await prisma.crisisMessage.update({
    where: { id: messageId },
    data: { isPinned: !message.isPinned },
    select: { isPinned: true },
  });

  return { isPinned: updated.isPinned };
}
