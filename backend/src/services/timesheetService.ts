import { BadgeType, TaskCategory, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

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
  const task = await prisma.volunteerTask.findUniqueOrThrow({ where: { id: taskId } });

  if (task.status !== TaskStatus.PENDING) {
    throw new Error("Task has already been reviewed");
  }

  let pointsAwarded = 0;

  if (decision === "VERIFIED") {
    pointsAwarded = calcPoints(task.hoursSpent, task.category);

    // Update task
    await prisma.volunteerTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.VERIFIED,
        pointsAwarded,
        verifiedById: adminId,
        verifiedAt: new Date()
      }
    });

    // Atomically update volunteer totals using absolute values for MongoDB compatibility
    const currUser = await prisma.user.findUnique({
      where: { id: task.volunteerId },
      select: { totalPoints: true, totalVerifiedHours: true }
    });
    
    await prisma.user.update({
      where: { id: task.volunteerId },
      data: {
        totalPoints: (currUser?.totalPoints || 0) + pointsAwarded,
        totalVerifiedHours: (currUser?.totalVerifiedHours || 0) + task.hoursSpent
      }
    });

    // Check and award badges
    await checkAndAwardBadges(task.volunteerId);
  } else {
    await prisma.volunteerTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.REJECTED,
        verifiedById: adminId,
        verifiedAt: new Date(),
        rejectionReason: rejectionReason ?? null
      }
    });
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

async function checkAndAwardBadges(volunteerId: string) {
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

// ── Public leaderboard ────────────────────────────────────────────────────
export type LeaderboardPeriod = "all" | "month" | "week";

export async function getLeaderboard(period: LeaderboardPeriod = "all", limit = 50) {
  if (period === "all") {
    // Query on the cached totalPoints field — very fast
    const volunteers = await prisma.user.findMany({
      where: { role: "VOLUNTEER", isBanned: false },
      orderBy: { totalPoints: "desc" },
      take: limit,
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        totalPoints: true,
        totalVerifiedHours: true,
        badges: { select: { badgeType: true, awardedAt: true } },
        reviewsReceived: { select: { rating: true } }
      }
    });

    return volunteers.map((v, idx) => ({
      rank: idx + 1,
      id: v.id,
      fullName: v.fullName,
      avatarUrl: v.avatarUrl,
      totalPoints: v.totalPoints,
      totalVerifiedHours: v.totalVerifiedHours,
      badgeCount: v.badges.length,
      badges: v.badges,
      avgRating:
        v.reviewsReceived.length > 0
          ? Number(
              (
                v.reviewsReceived.reduce((s, r) => s + r.rating, 0) / v.reviewsReceived.length
              ).toFixed(1)
            )
          : null,
      reviewCount: v.reviewsReceived.length
    }));
  }

  // For month/week — aggregate from VolunteerTask
  const since =
    period === "month"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const grouped = await prisma.volunteerTask.groupBy({
    by: ["volunteerId"],
    where: { status: TaskStatus.VERIFIED, verifiedAt: { gte: since } },
    _sum: { pointsAwarded: true, hoursSpent: true },
    orderBy: { _sum: { pointsAwarded: "desc" } },
    take: limit
  });

  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.volunteerId);
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isBanned: false },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      badges: { select: { badgeType: true, awardedAt: true } },
      reviewsReceived: { select: { rating: true } }
    }
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return grouped
    .filter((g) => userMap.has(g.volunteerId))
    .map((g, idx) => {
      const u = userMap.get(g.volunteerId)!;
      return {
        rank: idx + 1,
        id: u.id,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        totalPoints: g._sum.pointsAwarded ?? 0,
        totalVerifiedHours: g._sum.hoursSpent ?? 0,
        badgeCount: u.badges.length,
        badges: u.badges,
        avgRating:
          u.reviewsReceived.length > 0
            ? Number(
                (
                  u.reviewsReceived.reduce((s, r) => s + r.rating, 0) / u.reviewsReceived.length
                ).toFixed(1)
              )
            : null,
        reviewCount: u.reviewsReceived.length
      };
    });
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
