import { prisma } from "../lib/prisma.js";
import { createReviewSchema } from "../utils/validation.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { SafeError } from "../utils/SafeError.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const REVIEW_ELIGIBILITY_RADIUS_KM = 15;

// P2: Removed naive keyword fraud detection — replaced by rating-based flagging

const REVIEWABLE_RESPONDER_STATUSES = [
  "RESPONDING",
  "EN_ROUTE",
  "ON_SITE",
  "COMPLETED"
] as const;

let legacyReviewCleanupPromise: Promise<void> | null = null;

type EligibleReviewCrisis = {
  id: string;
  title: string;
  incidentType: string;
  severityLevel: string;
  status: string;
  locationText: string;
  responderStatus: string;
  lastStatusAt: string;
};

function ensureCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): latitude is number {
  return latitude != null && longitude != null;
}

async function ensureLegacyReviewDataConsistency(): Promise<void> {
  if (!legacyReviewCleanupPromise) {
    legacyReviewCleanupPromise = (async () => {
      const result = (await prisma.$runCommandRaw({
        delete: "Review",
        deletes: [{ q: { crisisEventId: null }, limit: 0 }]
      })) as { n?: number };

      const deletedCount = Number(result?.n ?? 0);
      if (deletedCount > 0) {
        console.warn(
          `[reviewService] Removed ${deletedCount} legacy review record(s) with null crisisEventId`
        );
      }
    })();
  }

  await legacyReviewCleanupPromise;
}

async function hasReviewerCrisisInteraction(
  reviewerId: string,
  crisisEventId: string,
  crisisLatitude: number,
  crisisLongitude: number
): Promise<boolean> {
  const [incidentLinked, docLinked, evidencePosts, reservations] =
    await Promise.all([
      prisma.crisisEventReport.findFirst({
        where: {
          crisisEventId,
          incidentReport: {
            reporterId: reviewerId
          }
        },
        select: { id: true }
      }),
      prisma.secureFolder.findFirst({
        where: {
          ownerId: reviewerId,
          crisisId: crisisEventId,
          isDeleted: false
        },
        select: { id: true }
      }),
      prisma.evidencePost.findMany({
        where: {
          userId: reviewerId,
          latitude: { not: null },
          longitude: { not: null }
        },
        select: {
          id: true,
          latitude: true,
          longitude: true
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      }),
      prisma.reservation.findMany({
        where: { userId: reviewerId },
        include: {
          resource: {
            select: {
              latitude: true,
              longitude: true
            }
          }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      })
    ]);

  if (incidentLinked || docLinked) {
    return true;
  }

  const evidenceLinked = evidencePosts.some((post) => {
    if (!ensureCoordinates(post.latitude, post.longitude)) return false;
    return (
      haversineDistanceKm(
        crisisLatitude,
        crisisLongitude,
        post.latitude,
        post.longitude!
      ) <= REVIEW_ELIGIBILITY_RADIUS_KM
    );
  });

  if (evidenceLinked) {
    return true;
  }

  return reservations.some((reservation) => {
    if (
      reservation.resource?.latitude == null ||
      reservation.resource.longitude == null
    ) {
      return false;
    }

    return (
      haversineDistanceKm(
        crisisLatitude,
        crisisLongitude,
        reservation.resource.latitude,
        reservation.resource.longitude
      ) <= REVIEW_ELIGIBILITY_RADIUS_KM
    );
  });
}

async function assertReviewEligibility(
  reviewerId: string,
  volunteerId: string,
  crisisEventId: string
): Promise<void> {
  const [reviewer, volunteer, crisis, responderRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        role: true,
        isBanned: true,
        latitude: true,
        longitude: true,
        createdAt: true
      }
    }),
    prisma.user.findUnique({
      where: { id: volunteerId },
      select: { role: true }
    }),
    prisma.crisisEvent.findUnique({
      where: { id: crisisEventId },
      select: {
        id: true,
        latitude: true,
        longitude: true
      }
    }),
    prisma.crisisResponder.findFirst({
      where: {
        crisisEventId,
        volunteerId,
        status: { in: [...REVIEWABLE_RESPONDER_STATUSES] }
      },
      select: { id: true }
    })
  ]);

  if (!reviewer) {
    throw new SafeError("Reviewer not found");
  }

  if (reviewer.role !== "USER") {
    throw new SafeError("Only users can submit volunteer reviews");
  }

  if (reviewer.isBanned) {
    throw new SafeError("Reviewer account is blocked");
  }

  if (!volunteer || volunteer.role !== "VOLUNTEER") {
    throw new SafeError("Volunteer not found");
  }

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  if (!responderRecord) {
    throw new SafeError("This volunteer is not an active responder for the selected crisis");
  }

  if (!ensureCoordinates(crisis.latitude, crisis.longitude)) {
    throw new SafeError("This crisis does not have a verifiable location for review eligibility");
  }

  if (!ensureCoordinates(reviewer.latitude, reviewer.longitude)) {
    throw new SafeError("Please enable your location to submit a crisis-scoped review");
  }

  const reviewerDistance = haversineDistanceKm(
    crisis.latitude,
    crisis.longitude!,
    reviewer.latitude,
    reviewer.longitude!
  );

  if (reviewerDistance > REVIEW_ELIGIBILITY_RADIUS_KM) {
    throw new SafeError("Only users near this crisis can review responders");
  }

  const hasInteraction = await hasReviewerCrisisInteraction(
    reviewerId,
    crisisEventId,
    crisis.latitude,
    crisis.longitude!
  );

  if (!hasInteraction) {
    throw new SafeError(
      "You must have a verified interaction with this crisis to review responders"
    );
  }
}

export async function submitReview(reviewerId: string, payload: unknown) {
  const parsed = createReviewSchema.parse(payload);
  const {
    volunteerId,
    rating,
    text,
    interactionContext,
    interactionDate,
    wouldWorkAgain,
    crisisEventId
  } = parsed;

  if (reviewerId === volunteerId) {
    throw new SafeError("You cannot review yourself");
  }

  await assertReviewEligibility(reviewerId, volunteerId, crisisEventId);

  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { createdAt: true }
  });

  if (!reviewer) {
    throw new SafeError("Reviewer not found");
  }

  const now = Date.now();
  const flagReasons: string[] = [];

  if (now - reviewer.createdAt.getTime() < ONE_DAY_MS) {
    flagReasons.push("Account less than 1 day old");
  }

  if (text.length < 20) {
    flagReasons.push("Review text too short");
  }

  const recentReviewCount = await prisma.review.count({
    where: {
      reviewerId,
      createdAt: { gte: new Date(now - ONE_DAY_MS) }
    }
  });

  if (recentReviewCount >= 3) {
    flagReasons.push("3+ reviews submitted in 24 hours");
  }

  // P2: Removed naive keyword fraud detection

  const isFlagged = flagReasons.length > 0;

  // Use a transaction to atomically check for existing review and create
  const review = await prisma.$transaction(async (tx) => {
    const existing = await tx.review.findFirst({
      where: { reviewerId, volunteerId, crisisEventId }
    });

    if (existing) {
      throw new SafeError("You have already reviewed this responder for this crisis");
    }

    return tx.review.create({
      data: {
        reviewerId,
        volunteerId,
        rating,
        text,
        interactionContext,
        interactionDate: new Date(interactionDate),
        wouldWorkAgain,
        crisisEventId,
        isFlagged,
        flagReasons
      },
      include: {
        reviewer: { select: { fullName: true, avatarUrl: true } }
      }
    });
  });

  await checkAndFlagVolunteer(volunteerId);
  return review;
}

async function checkAndFlagVolunteer(volunteerId: string) {
  const reviews = await prisma.review.findMany({
    where: { volunteerId },
    select: {
      rating: true,
      text: true,
      wouldWorkAgain: true,
      createdAt: true
    },
    take: 500,
    orderBy: { createdAt: "desc" }
  });

  const volunteerFlagReasons: string[] = [];
  const totalReviews = reviews.length;

  if (totalReviews >= 5) {
    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
    if (averageRating < 2.0) {
      volunteerFlagReasons.push(
        `Average rating below 2.0 (${averageRating.toFixed(2)} stars across ${totalReviews} reviews)`
      );
    }
  }

  // P2: Removed naive keyword fraud detection from volunteer flagging

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
  const recentNegativeReviews = reviews.filter(
    (review) => !review.wouldWorkAgain && review.createdAt >= thirtyDaysAgo
  ).length;

  if (recentNegativeReviews >= 3) {
    volunteerFlagReasons.push(
      `${recentNegativeReviews} "Would not work again" responses in 30 days`
    );
  }

  await prisma.user.update({
    where: { id: volunteerId },
    data: {
      isFlagged: volunteerFlagReasons.length > 0,
      volunteerFlagReasons
    }
  });
}

export async function listEligibleReviewCrises(
  reviewerId: string,
  volunteerId: string
): Promise<EligibleReviewCrisis[]> {
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { role: true, latitude: true, longitude: true }
  });

  if (!reviewer || reviewer.role !== "USER") {
    return [];
  }

  const volunteer = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: { role: true }
  });

  if (!volunteer || volunteer.role !== "VOLUNTEER") {
    return [];
  }

  const responderRecords = await prisma.crisisResponder.findMany({
    where: {
      volunteerId,
      status: { in: [...REVIEWABLE_RESPONDER_STATUSES] }
    },
    include: {
      crisisEvent: {
        select: {
          id: true,
          title: true,
          incidentType: true,
          severityLevel: true,
          status: true,
          locationText: true,
          latitude: true,
          longitude: true
        }
      }
    },
    orderBy: { lastStatusAt: "desc" },
    take: 100
  });

  const eligible: EligibleReviewCrisis[] = [];

  for (const record of responderRecords) {
    const crisis = record.crisisEvent;
    if (
      !ensureCoordinates(crisis.latitude, crisis.longitude) ||
      !ensureCoordinates(reviewer.latitude, reviewer.longitude)
    ) {
      continue;
    }

    const distance = haversineDistanceKm(
      crisis.latitude,
      crisis.longitude!,
      reviewer.latitude,
      reviewer.longitude!
    );

    if (distance > REVIEW_ELIGIBILITY_RADIUS_KM) {
      continue;
    }

    const hasInteraction = await hasReviewerCrisisInteraction(
      reviewerId,
      crisis.id,
      crisis.latitude,
      crisis.longitude!
    );

    if (!hasInteraction) {
      continue;
    }

    eligible.push({
      id: crisis.id,
      title: crisis.title,
      incidentType: crisis.incidentType,
      severityLevel: crisis.severityLevel,
      status: crisis.status,
      locationText: crisis.locationText,
      responderStatus: record.status,
      lastStatusAt: record.lastStatusAt.toISOString()
    });
  }

  return eligible;
}

export async function getVolunteerReviews(volunteerId: string) {
  await ensureLegacyReviewDataConsistency();

  const reviews = await prisma.review.findMany({
    where: { volunteerId },
    include: {
      reviewer: { select: { fullName: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  return { reviews, averageRating };
}

export async function listFlaggedReviews() {
  await ensureLegacyReviewDataConsistency();

  // P0-18: Never return credential fields (email, phone, passwordHash, resetTokenHash, etc.)
  return prisma.review.findMany({
    where: { isFlagged: true },
    take: 100,
    include: {
      reviewer: { select: { id: true, fullName: true } },
      volunteer: { select: { id: true, fullName: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function listFlaggedVolunteers() {
  // P0-18: Explicit safe select — never return passwordHash, resetTokenHash, email, phone
  return prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      isFlagged: true
    },
    take: 100,
    select: {
      id: true,
      fullName: true,
      location: true,
      role: true,
      isFlagged: true,
      isBanned: true,
      volunteerFlagReasons: true,
      createdAt: true,
      reviewsReceived: {
        select: {
          rating: true,
          wouldWorkAgain: true,
          isFlagged: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function approveReview(reviewId: string) {
  await ensureLegacyReviewDataConsistency();

  const review = await prisma.review.findUnique({
    where: { id: reviewId }
  });

  if (!review) {
    throw new SafeError("Review not found");
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      isFlagged: false,
      flagReasons: []
    }
  });

  await checkAndFlagVolunteer(review.volunteerId);
}

export async function deleteReview(reviewId: string) {
  await ensureLegacyReviewDataConsistency();

  const review = await prisma.review.findUnique({
    where: { id: reviewId }
  });

  if (!review) {
    throw new SafeError("Review not found");
  }

  await prisma.review.delete({
    where: { id: reviewId }
  });

  await checkAndFlagVolunteer(review.volunteerId);
}

export async function approveVolunteer(volunteerId: string) {
  const volunteer = await prisma.user.findUnique({
    where: { id: volunteerId }
  });

  if (!volunteer) {
    throw new SafeError("Volunteer not found");
  }

  if (volunteer.role !== "VOLUNTEER") {
    throw new SafeError("User is not a volunteer");
  }

  await prisma.user.update({
    where: { id: volunteerId },
    data: {
      isFlagged: false,
      volunteerFlagReasons: []
    }
  });
}

export async function banVolunteer(volunteerId: string) {
  const volunteer = await prisma.user.findUnique({
    where: { id: volunteerId }
  });

  if (!volunteer) {
    throw new SafeError("Volunteer not found");
  }

  if (volunteer.role !== "VOLUNTEER") {
    throw new SafeError("User is not a volunteer");
  }

  await prisma.user.update({
    where: { id: volunteerId },
    data: { isBanned: true }
  });

  // P0-03: Invalidate the auth status cache so the ban takes effect immediately
  const { invalidateUserStatusCache } = await import("../middleware/auth.js");
  invalidateUserStatusCache(volunteerId);
}
