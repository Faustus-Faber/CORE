import { prisma } from "../lib/prisma.js";
import { createReviewSchema } from "../utils/validation.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const FRAUD_KEYWORDS = [
    "scam",
    "fake",
    "fraud",
    "not present",
    "took supplies",
    "stole",
    "liar",
    "dishonest",
    "corrupt",
    "bribe"
];

export async function submitReview(reviewerId: string, payload: unknown) {
    const parsed = createReviewSchema.parse(payload);
    const { volunteerId, rating, text, interactionContext, interactionDate, wouldWorkAgain, crisisEventId } = parsed;

    // Load reviewer to check account age
    const reviewer = await prisma.user.findUnique({
        where: { id: reviewerId },
        select: { createdAt: true }
    });

    if (!reviewer) {
        throw new Error("Reviewer not found");
    }

    // Prevent self-review
    if (reviewerId === volunteerId) {
        throw new Error("You cannot review yourself");
    }

    // Ensure volunteer exists and has the VOLUNTEER role
    const volunteer = await prisma.user.findUnique({
        where: { id: volunteerId },
        select: { role: true }
    });

    if (!volunteer || volunteer.role !== "VOLUNTEER") {
        throw new Error("Volunteer not found");
    }

    // Prevent duplicate reviews
    const existing = await prisma.review.findFirst({
        where: { reviewerId, volunteerId }
    });

    if (existing) {
        throw new Error("You have already reviewed this volunteer");
    }

    // --- Fraud detection ---
    const flagReasons: string[] = [];
    const now = Date.now();

    // Rule 1: account less than 1 day old
    if (now - reviewer.createdAt.getTime() < ONE_DAY_MS) {
        flagReasons.push("Account less than 1 day old");
    }

    // Rule 2: review text too short (already validated, but double check)
    if (text.length < 20) {
        flagReasons.push("Review text too short");
    }

    // Rule 3: 3+ reviews in the last 24 hours
    const recentReviewCount = await prisma.review.count({
        where: {
            reviewerId,
            createdAt: { gte: new Date(now - ONE_DAY_MS) }
        }
    });

    if (recentReviewCount >= 3) {
        flagReasons.push("3+ reviews submitted in 24 hours");
    }

    // Rule 4: Fraud keyword detection
    const lowerText = text.toLowerCase();
    const detectedKeywords = FRAUD_KEYWORDS.filter(keyword => lowerText.includes(keyword));
    if (detectedKeywords.length > 0) {
        flagReasons.push(`Contains fraud keywords: ${detectedKeywords.join(", ")}`);
    }

    const isFlagged = flagReasons.length > 0;

    const review = await prisma.review.create({
        data: {
            reviewerId,
            volunteerId,
            rating,
            text,
            interactionContext,
            interactionDate: new Date(interactionDate),
            wouldWorkAgain,
            crisisEventId: crisisEventId || null,
            isFlagged,
            flagReasons
        },
        include: {
            reviewer: { select: { fullName: true, avatarUrl: true } }
        }
    });

    // --- Volunteer-level fraud detection ---
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
        }
    });

    const volunteerFlagReasons: string[] = [];
    const totalReviews = reviews.length;

    // Rule 1: Average rating < 2.0 across 5+ reviews
    if (totalReviews >= 5) {
        const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
        if (averageRating < 2.0) {
            volunteerFlagReasons.push(`Average rating below 2.0 (${averageRating.toFixed(2)} stars across ${totalReviews} reviews)`);
        }
    }

    // Rule 2: 40%+ reviews contain fraud keywords
    if (totalReviews >= 3) {
        const reviewsWithFraudKeywords = reviews.filter(r =>
            FRAUD_KEYWORDS.some(keyword => r.text.toLowerCase().includes(keyword))
        ).length;
        const fraudPercentage = (reviewsWithFraudKeywords / totalReviews) * 100;
        if (fraudPercentage >= 40) {
            volunteerFlagReasons.push(`${fraudPercentage.toFixed(0)}% of reviews contain fraud indicators`);
        }
    }

    // Rule 3: 3+ "Would not work again" in 30 days
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    const recentNegativeReviews = reviews.filter(r =>
        !r.wouldWorkAgain && r.createdAt >= thirtyDaysAgo
    ).length;

    if (recentNegativeReviews >= 3) {
        volunteerFlagReasons.push(`${recentNegativeReviews} "Would not work again" responses in 30 days`);
    }

    // Update volunteer flag status
    const isFlagged = volunteerFlagReasons.length > 0;
    await prisma.user.update({
        where: { id: volunteerId },
        data: {
            isFlagged,
            volunteerFlagReasons
        }
    });
}

export async function getVolunteerReviews(volunteerId: string) {
    const reviews = await prisma.review.findMany({
        where: { volunteerId },
        include: {
            reviewer: { select: { fullName: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    const averageRating =
        reviews.length > 0
            ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
            : null;

    return { reviews, averageRating };
}

export async function listFlaggedReviews() {
    const reviews = await prisma.review.findMany({
        where: { isFlagged: true },
        include: {
            reviewer: { select: { id: true, fullName: true, email: true } },
            volunteer: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    return reviews;
}

export async function listFlaggedVolunteers() {
    const volunteers = await prisma.user.findMany({
        where: {
            role: "VOLUNTEER",
            isFlagged: true
        },
        include: {
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

    return volunteers;
}

export async function approveReview(reviewId: string) {
    const review = await prisma.review.findUnique({
        where: { id: reviewId }
    });

    if (!review) {
        throw new Error("Review not found");
    }

    await prisma.review.update({
        where: { id: reviewId },
        data: {
            isFlagged: false,
            flagReasons: []
        }
    });

    // Re-check volunteer flag status after approving review
    await checkAndFlagVolunteer(review.volunteerId);
}

export async function deleteReview(reviewId: string) {
    const review = await prisma.review.findUnique({
        where: { id: reviewId }
    });

    if (!review) {
        throw new Error("Review not found");
    }

    const volunteerId = review.volunteerId;

    await prisma.review.delete({
        where: { id: reviewId }
    });

    // Re-check volunteer flag status after deleting review
    await checkAndFlagVolunteer(volunteerId);
}

export async function approveVolunteer(volunteerId: string) {
    const volunteer = await prisma.user.findUnique({
        where: { id: volunteerId }
    });

    if (!volunteer) {
        throw new Error("Volunteer not found");
    }

    if (volunteer.role !== "VOLUNTEER") {
        throw new Error("User is not a volunteer");
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
        throw new Error("Volunteer not found");
    }

    if (volunteer.role !== "VOLUNTEER") {
        throw new Error("User is not a volunteer");
    }

    await prisma.user.update({
        where: { id: volunteerId },
        data: {
            isBanned: true
        }
    });
}
