import { BadgeType, TaskCategory, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";
import { requiresTaskEvidence } from "./trustTierService.js";

// ── Category multipliers ───────────────────────────────────────────────────
const MULTIPLIERS: Record<TaskCategory, number> = {
  RESCUE: 3,
  MEDICAL_AID: 2.5,
  SUPPLY_DISTRIBUTION: 2,
  SHELTER_SETUP: 2,
  CLEANUP: 1.5,
  COUNSELING: 2,
  TRANSPORTATION: 1.5,
  OTHER: 1
};

const BASE_POINTS_PER_HOUR = 10;

function calcPoints(hours: number, category: TaskCategory): number {
  return Math.round(hours * BASE_POINTS_PER_HOUR * MULTIPLIERS[category]);
}

// ── Log a new task ─────────────────────────────────────────────────────────
export interface LogTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  hoursSpent: number;
  dateOfTask: Date;
  crisisEventId?: string | null;
  evidenceUrls?: string[];
}

export async function logTask(volunteerId: string, input: LogTaskInput) {
  // Validate hours and date
  if (!Number.isFinite(input.hoursSpent) || input.hoursSpent <= 0) {
    throw new SafeError("Hours spent must be a positive number");
  }
  if (input.hoursSpent > 24) {
    throw new SafeError("Hours spent cannot exceed 24 per task");
  }
  if (input.dateOfTask > new Date()) {
    throw new SafeError("Task date cannot be in the future");
  }
  if (!Object.values(TaskCategory).includes(input.category)) {
    throw new SafeError("Invalid task category");
  }

  // Tier 0 (Reporter) and Tier 1 (Trainee) must provide photo evidence for tasks.
  // Tier 2 (Responder) and Tier 3 (Veteran) are trusted and don't need evidence.
  const needsEvidence = await requiresTaskEvidence(volunteerId);
  if (needsEvidence) {
    if (!input.evidenceUrls || input.evidenceUrls.length === 0) {
      throw new SafeError(
        "Photo evidence is required for task submissions. Please upload at least one photo as evidence of your work."
      );
    }
  }

  const task = await prisma.volunteerTask.create({
    data: {
      volunteerId,
      title: input.title,
      description: input.description,
      category: input.category,
      hoursSpent: input.hoursSpent,
      dateOfTask: input.dateOfTask,
      crisisEventId: input.crisisEventId ?? null,
      evidenceUrls: input.evidenceUrls ?? [],
      status: TaskStatus.PENDING
    }
  });
  return task;
}

// ── Get volunteer's own timesheet ──────────────────────────────────────────
export async function getMyTimesheet(volunteerId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    prisma.volunteerTask.findMany({
      where: { volunteerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.volunteerTask.count({ where: { volunteerId } })
  ]);

  const user = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: { totalPoints: true, totalVerifiedHours: true, badges: true }
  });

  return { tasks, total, page, limit, summary: user };
}

// ── Admin: list pending tasks ──────────────────────────────────────────────
export async function getPendingTasks(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    prisma.volunteerTask.findMany({
      where: { status: TaskStatus.PENDING },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      include: {
        volunteer: { select: { id: true, fullName: true, email: true, avatarUrl: true } }
      }
    }),
    prisma.volunteerTask.count({ where: { status: TaskStatus.PENDING } })
  ]);

  return { tasks, total, page, limit };
}

// ── Admin: verify or reject a task ────────────────────────────────────────
export async function verifyTask(
  taskId: string,
  adminId: string,
  decision: "VERIFIED" | "REJECTED",
  rejectionReason?: string
) {
  let pointsAwarded = 0;
  let volunteerId = "";
  let taskTitle = "";

  if (decision === "VERIFIED") {
    // Use an interactive transaction so the status re-check and update are atomic
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.volunteerTask.findUniqueOrThrow({ where: { id: taskId } });

      if (task.status !== TaskStatus.PENDING) {
        throw new SafeError("Task has already been reviewed");
      }

      pointsAwarded = calcPoints(task.hoursSpent, task.category);

      const updated = await tx.volunteerTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.VERIFIED,
          pointsAwarded,
          verifiedById: adminId,
          verifiedAt: new Date()
        }
      });

      await tx.user.update({
        where: { id: task.volunteerId },
        data: {
          totalPoints: { increment: pointsAwarded },
          totalVerifiedHours: { increment: task.hoursSpent }
        }
      });

      return { task, updated };
    });

    volunteerId = result.task.volunteerId;
    taskTitle = result.task.title;

    // Check and award badges + promote trust tier outside the transaction (non-critical)
    await checkAndAwardBadges(result.task.volunteerId);
    try {
      const { checkAndPromoteTrustTier } = await import("./trustTierService.js");
      await checkAndPromoteTrustTier(result.task.volunteerId);
    } catch (err) {
      console.error("[verify-task] Trust tier promotion failed:", err);
    }

    // Notify the volunteer that their task was verified
    await prisma.notification
      .create({
        data: {
          userId: volunteerId,
          title: `Task Verified: +${pointsAwarded} points`,
          body: `Your task "${taskTitle}" was verified by an admin. You earned ${pointsAwarded} points and ${result.task.hoursSpent} verified hours.`,
          type: "TASK_VERIFIED",
        },
      })
      .catch(() => null);
  } else {
    // Reject path: also re-check atomically to prevent double-review
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.volunteerTask.findUniqueOrThrow({ where: { id: taskId } });

      if (task.status !== TaskStatus.PENDING) {
        throw new SafeError("Task has already been reviewed");
      }

      const updated = await tx.volunteerTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.REJECTED,
          verifiedById: adminId,
          verifiedAt: new Date(),
          rejectionReason: rejectionReason ?? null
        }
      });

      return { task, updated };
    });

    volunteerId = result.task.volunteerId;
    taskTitle = result.task.title;

    // Notify the volunteer that their task was rejected
    await prisma.notification
      .create({
        data: {
          userId: volunteerId,
          title: "Task Rejected",
          body: `Your task "${taskTitle}" was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
          type: "TASK_REJECTED",
        },
      })
      .catch(() => null);
  }

  return { taskId, decision, pointsAwarded };
}

// ── Badge engine ──────────────────────────────────────────────────────────
async function awardBadgeIfNew(userId: string, badgeType: BadgeType) {
  // upsert-style: skip if already exists
  await prisma.badge
    .create({ data: { userId, badgeType } })
    .catch(() => null); // unique constraint violation means already awarded
}

export async function checkAndAwardBadges(volunteerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: {
      totalPoints: true,
      totalVerifiedHours: true,
      reviewsReceived: { select: { rating: true } },
      badges: { select: { badgeType: true } }
    }
  });

  if (!user) return;

  const earnedTypes = new Set(user.badges.map((b) => b.badgeType));

  // 🌱 First Responder — first verified task
  if (!earnedTypes.has(BadgeType.FIRST_RESPONDER)) {
    const verifiedCount = await prisma.volunteerTask.count({
      where: { volunteerId, status: TaskStatus.VERIFIED }
    });
    if (verifiedCount >= 1) await awardBadgeIfNew(volunteerId, BadgeType.FIRST_RESPONDER);
  }

  // ⭐ Rising Star — 100+ points
  if (!earnedTypes.has(BadgeType.RISING_STAR) && user.totalPoints >= 100) {
    await awardBadgeIfNew(volunteerId, BadgeType.RISING_STAR);
  }

  // 🔥 Crisis Hero — 50+ verified hours
  if (!earnedTypes.has(BadgeType.CRISIS_HERO) && user.totalVerifiedHours >= 50) {
    await awardBadgeIfNew(volunteerId, BadgeType.CRISIS_HERO);
  }

  // 🛡 Community Guardian — avgRating ≥ 4.5 with 10+ reviews
  if (!earnedTypes.has(BadgeType.COMMUNITY_GUARDIAN) && user.reviewsReceived.length >= 10) {
    const avg =
      user.reviewsReceived.reduce((s, r) => s + r.rating, 0) / user.reviewsReceived.length;
    if (avg >= 4.5) await awardBadgeIfNew(volunteerId, BadgeType.COMMUNITY_GUARDIAN);
  }

  // 💯 Century — 100 verified tasks
  if (!earnedTypes.has(BadgeType.CENTURY)) {
    const verifiedCount = await prisma.volunteerTask.count({
      where: { volunteerId, status: TaskStatus.VERIFIED }
    });
    if (verifiedCount >= 100) await awardBadgeIfNew(volunteerId, BadgeType.CENTURY);
  }

  // 🤝 Team Player — tasks across 5+ distinct crisis events
  if (!earnedTypes.has(BadgeType.TEAM_PLAYER)) {
    const distinct = await prisma.volunteerTask.groupBy({
      by: ["crisisEventId"],
      where: { volunteerId, status: TaskStatus.VERIFIED, crisisEventId: { not: null } }
    });
    if (distinct.length >= 5) await awardBadgeIfNew(volunteerId, BadgeType.TEAM_PLAYER);
  }

  // 🏆 Elite Volunteer — top 10 all-time
  if (!earnedTypes.has(BadgeType.ELITE_VOLUNTEER)) {
    const topTen = await prisma.user.findMany({
      where: { role: "VOLUNTEER", isBanned: false },
      orderBy: { totalPoints: "desc" },
      take: 10,
      select: { id: true }
    });
    if (topTen.some((u) => u.id === volunteerId)) {
      await awardBadgeIfNew(volunteerId, BadgeType.ELITE_VOLUNTEER);
    }
  }
}

// ── Active / recent crises (for dropdown) ─────────────────────────────────
export async function getActiveCrisesForDropdown() {
  return prisma.crisisEvent.findMany({
    where: {
      status: { notIn: ["CLOSED"] }
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, status: true, incidentType: true }
  });
}

// ── Community Impact Board (replaces competitive leaderboard) ──────────────
export async function getLeaderboard(period: "all" | "month" | "week" = "all", limit = 50) {
  const where = {
    role: "VOLUNTEER" as const,
    isBanned: false,
    ...(period === "week"
      ? { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      : period === "month"
        ? { updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { totalPoints: "desc" },
    take: limit,
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      totalPoints: true,
      totalVerifiedHours: true,
      trustTier: true,
      _count: { select: { badges: true } },
    },
  });

  // Get review stats for each user
  const userIds = users.map((u) => u.id);
  const reviewStats = await prisma.review.groupBy({
    by: ["volunteerId"],
    where: { volunteerId: { in: userIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const reviewMap = new Map(reviewStats.map((r) => [r.volunteerId, r]));

  return {
    period,
    entries: users.map((u, index) => {
      const review = reviewMap.get(u.id);
      return {
        id: u.id,
        rank: index + 1,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        totalPoints: u.totalPoints,
        totalVerifiedHours: u.totalVerifiedHours,
        badgeCount: u._count.badges,
        trustTier: u.trustTier,
        avgRating: review?._avg.rating ?? null,
        reviewCount: review?._count.rating ?? 0,
      };
    }),
  };
}
