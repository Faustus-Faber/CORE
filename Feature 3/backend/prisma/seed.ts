import "dotenv/config";

import { PrismaClient, Role, InteractionContext } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting seed process...");

    // ─────────────────────────────────────────────────────────────
    // 1. Seed Admin Account
    // ─────────────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@core.local";
    const adminPhone = process.env.ADMIN_PHONE ?? "+8801700000000";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";

    const existingAdmin = await prisma.user.findFirst({
        where: {
            OR: [{ email: adminEmail }, { phone: adminPhone }]
        }
    });

    if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);

        await prisma.user.create({
            data: {
                fullName: process.env.ADMIN_NAME ?? "CORE Admin",
                email: adminEmail,
                phone: adminPhone,
                passwordHash,
                location: process.env.ADMIN_LOCATION ?? "Dhaka",
                role: Role.ADMIN,
                skills: []
            }
        });
        console.log("✓ Admin account created");
    } else {
        console.log("✓ Admin seed skipped: admin already exists");
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Seed Test Users (for submitting reviews)
    // ─────────────────────────────────────────────────────────────
    const users = await prisma.user.findMany({
        where: { role: Role.USER }
    });

    let user1, user2, user3, user4, user5, user6;

    if (users.length === 0) {
        const userPassword = await bcrypt.hash("User@12345", 12);
        const oldUserDate = new Date();
        oldUserDate.setDate(oldUserDate.getDate() - 60); // 60 days old

        user1 = await prisma.user.create({
            data: {
                fullName: "Alice Johnson",
                email: "alice@core.local",
                phone: "+8801700000001",
                passwordHash: userPassword,
                location: "Dhaka",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        user2 = await prisma.user.create({
            data: {
                fullName: "Bob Smith",
                email: "bob@core.local",
                phone: "+8801700000002",
                passwordHash: userPassword,
                location: "Chittagong",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        user3 = await prisma.user.create({
            data: {
                fullName: "Carol Williams",
                email: "carol@core.local",
                phone: "+8801700000003",
                passwordHash: userPassword,
                location: "Sylhet",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        user4 = await prisma.user.create({
            data: {
                fullName: "David Brown",
                email: "david@core.local",
                phone: "+8801700000004",
                passwordHash: userPassword,
                location: "Rajshahi",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        user5 = await prisma.user.create({
            data: {
                fullName: "Eve Davis",
                email: "eve@core.local",
                phone: "+8801700000005",
                passwordHash: userPassword,
                location: "Khulna",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        // New user (less than 24 hours old - for fraud detection demo)
        user6 = await prisma.user.create({
            data: {
                fullName: "Frank Miller (New)",
                email: "frank@core.local",
                phone: "+8801700000006",
                passwordHash: userPassword,
                location: "Barisal",
                role: Role.USER,
                skills: []
            }
        });

        console.log("✓ 6 test users created");
    } else {
        [user1, user2, user3, user4, user5, user6] = users;
        console.log("✓ Test users already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Seed Volunteers
    // ─────────────────────────────────────────────────────────────
    const volunteers = await prisma.user.findMany({
        where: { role: Role.VOLUNTEER }
    });

    let goodVolunteer, flaggedVolunteer1, flaggedVolunteer2;

    if (volunteers.length === 0) {
        const volunteerPassword = await bcrypt.hash("Volunteer@12345", 12);

        // Good volunteer with positive reviews
        goodVolunteer = await prisma.user.create({
            data: {
                fullName: "Sarah Rahman (Good Volunteer)",
                email: "sarah@core.local",
                phone: "+8801700000010",
                passwordHash: volunteerPassword,
                location: "Dhaka",
                role: Role.VOLUNTEER,
                skills: ["First Aid", "Search & Rescue", "CPR Certified"],
                availability: "Weekends",
                certifications: "Red Cross First Aid, Emergency Response"
            }
        });

        // Volunteer that will be flagged for low rating
        flaggedVolunteer1 = await prisma.user.create({
            data: {
                fullName: "Mike Wilson (Flagged - Low Rating)",
                email: "mike@core.local",
                phone: "+8801700000011",
                passwordHash: volunteerPassword,
                location: "Chittagong",
                role: Role.VOLUNTEER,
                skills: ["Supply Distribution"],
                availability: "Full-time",
                certifications: "None"
            }
        });

        // Volunteer that will be flagged for fraud keywords
        flaggedVolunteer2 = await prisma.user.create({
            data: {
                fullName: "Tom Harris (Flagged - Fraud Keywords)",
                email: "tom@core.local",
                phone: "+8801700000012",
                passwordHash: volunteerPassword,
                location: "Sylhet",
                role: Role.VOLUNTEER,
                skills: ["Medical Aid"],
                availability: "Part-time",
                certifications: "Basic Medical Training"
            }
        });

        console.log("✓ 3 test volunteers created");
    } else {
        goodVolunteer = volunteers.find(v => v.fullName.includes("Good")) || volunteers[0];
        flaggedVolunteer1 = volunteers.find(v => v.fullName.includes("Low Rating")) || volunteers[1];
        flaggedVolunteer2 = volunteers.find(v => v.fullName.includes("Fraud")) || volunteers[2];
        console.log("✓ Test volunteers already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Seed Reviews for Good Volunteer (All positive)
    // ─────────────────────────────────────────────────────────────
    const goodVolReviews = await prisma.review.findMany({
        where: { volunteerId: goodVolunteer.id }
    });

    if (goodVolReviews.length === 0) {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 30);

        await prisma.review.create({
            data: {
                reviewerId: user1.id,
                volunteerId: goodVolunteer.id,
                rating: 5,
                text: "Sarah was amazing! She helped us during the flood rescue operation. Very professional and caring. Highly recommend working with her again.",
                interactionContext: InteractionContext.RESCUE_OPERATION,
                interactionDate: oldDate,
                wouldWorkAgain: true
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user2.id,
                volunteerId: goodVolunteer.id,
                rating: 5,
                text: "Excellent volunteer! Sarah distributed medical supplies efficiently and was very kind to everyone. Would definitely work with her again.",
                interactionContext: InteractionContext.MEDICAL_AID,
                interactionDate: oldDate,
                wouldWorkAgain: true
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user3.id,
                volunteerId: goodVolunteer.id,
                rating: 4,
                text: "Great experience overall. Sarah was helpful during the shelter management. Very organized and calm under pressure.",
                interactionContext: InteractionContext.SHELTER_MANAGEMENT,
                interactionDate: oldDate,
                wouldWorkAgain: true
            }
        });

        console.log("✓ 3 positive reviews created for good volunteer");
    } else {
        console.log("✓ Reviews for good volunteer already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Seed Reviews for Flagged Volunteer 1 (Low Rating)
    // ─────────────────────────────────────────────────────────────
    const flaggedVol1Reviews = await prisma.review.findMany({
        where: { volunteerId: flaggedVolunteer1.id }
    });

    if (flaggedVol1Reviews.length === 0) {
        const oldDate1 = new Date();
        oldDate1.setDate(oldDate1.getDate() - 25);
        const oldDate2 = new Date();
        oldDate2.setDate(oldDate2.getDate() - 20);
        const oldDate3 = new Date();
        oldDate3.setDate(oldDate3.getDate() - 15);
        const oldDate4 = new Date();
        oldDate4.setDate(oldDate4.getDate() - 10);
        const oldDate5 = new Date();
        oldDate5.setDate(oldDate5.getDate() - 5);

        // 5 reviews with average < 2.0
        await prisma.review.create({
            data: {
                reviewerId: user1.id,
                volunteerId: flaggedVolunteer1.id,
                rating: 2,
                text: "Mike was not very helpful during the supply distribution. Seemed disorganized and slow.",
                interactionContext: InteractionContext.SUPPLY_DISTRIBUTION,
                interactionDate: oldDate1,
                wouldWorkAgain: false
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user2.id,
                volunteerId: flaggedVolunteer1.id,
                rating: 1,
                text: "Very disappointing experience. Mike did not show up on time and left early. Would not recommend.",
                interactionContext: InteractionContext.SUPPLY_DISTRIBUTION,
                interactionDate: oldDate2,
                wouldWorkAgain: false
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user3.id,
                volunteerId: flaggedVolunteer1.id,
                rating: 2,
                text: "Not satisfied with the service. Mike seemed uninterested and did not follow instructions properly.",
                interactionContext: InteractionContext.SUPPLY_DISTRIBUTION,
                interactionDate: oldDate3,
                wouldWorkAgain: false
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user4.id,
                volunteerId: flaggedVolunteer1.id,
                rating: 1,
                text: "Terrible experience. Mike was rude and unhelpful. The supplies were not distributed fairly.",
                interactionContext: InteractionContext.SUPPLY_DISTRIBUTION,
                interactionDate: oldDate4,
                wouldWorkAgain: false
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user5.id,
                volunteerId: flaggedVolunteer1.id,
                rating: 2,
                text: "Poor performance overall. Mike needs better training and attitude improvement.",
                interactionContext: InteractionContext.SUPPLY_DISTRIBUTION,
                interactionDate: oldDate5,
                wouldWorkAgain: false
            }
        });

        console.log("✓ 5 low-rating reviews created for flagged volunteer 1");
    } else {
        console.log("✓ Reviews for flagged volunteer 1 already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Seed Reviews for Flagged Volunteer 2 (Fraud Keywords)
    // ─────────────────────────────────────────────────────────────
    const flaggedVol2Reviews = await prisma.review.findMany({
        where: { volunteerId: flaggedVolunteer2.id }
    });

    if (flaggedVol2Reviews.length === 0) {
        const oldDate1 = new Date();
        oldDate1.setDate(oldDate1.getDate() - 20);
        const oldDate2 = new Date();
        oldDate2.setDate(oldDate2.getDate() - 15);
        const oldDate3 = new Date();
        oldDate3.setDate(oldDate3.getDate() - 10);

        // 3 reviews - 2 with fraud keywords (will be flagged at review level)
        await prisma.review.create({
            data: {
                reviewerId: user1.id,
                volunteerId: flaggedVolunteer2.id,
                rating: 1,
                text: "This is a scam! Tom took supplies and never showed up.",
                interactionContext: InteractionContext.MEDICAL_AID,
                interactionDate: oldDate1,
                wouldWorkAgain: false,
                isFlagged: true,
                flagReasons: ["Contains fraud keywords: scam, took supplies"]
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user2.id,
                volunteerId: flaggedVolunteer2.id,
                rating: 2,
                text: "Tom was not present. Very dishonest about his availability.",
                interactionContext: InteractionContext.MEDICAL_AID,
                interactionDate: oldDate2,
                wouldWorkAgain: false,
                isFlagged: true,
                flagReasons: ["Contains fraud keywords: not present, dishonest"]
            }
        });

        await prisma.review.create({
            data: {
                reviewerId: user3.id,
                volunteerId: flaggedVolunteer2.id,
                rating: 4,
                text: "Good medical assistance provided. Tom was knowledgeable.",
                interactionContext: InteractionContext.MEDICAL_AID,
                interactionDate: oldDate3,
                wouldWorkAgain: true
            }
        });

        console.log("✓ 3 reviews with fraud keywords created for flagged volunteer 2");
    } else {
        console.log("✓ Reviews for flagged volunteer 2 already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 6b. Seed Additional Flagged Reviews (for demo purposes)
    // ─────────────────────────────────────────────────────────────
    const existingFlaggedReviews = await prisma.review.count({
        where: { isFlagged: true }
    });

    if (existingFlaggedReviews < 3) {
        // Create a review from new user (account < 24 hours old)
        await prisma.review.create({
            data: {
                reviewerId: user6.id, // Frank - new user
                volunteerId: goodVolunteer.id,
                rating: 2,
                text: "Not satisfied with the service provided.",
                interactionContext: InteractionContext.OTHER,
                interactionDate: new Date(),
                wouldWorkAgain: false,
                isFlagged: true,
                flagReasons: ["Account less than 1 day old"]
            }
        });

        // Create a review with very short text
        await prisma.review.create({
            data: {
                reviewerId: user4.id,
                volunteerId: goodVolunteer.id,
                rating: 3,
                text: "Bad",
                interactionContext: InteractionContext.OTHER,
                interactionDate: new Date(),
                wouldWorkAgain: false,
                isFlagged: true,
                flagReasons: ["Review text too short"]
            }
        });

        console.log("✓ Additional flagged reviews created for demo");
    } else {
        console.log("✓ Flagged reviews already exist for demo");
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Trigger volunteer flag check
    // ─────────────────────────────────────────────────────────────
    console.log("Running volunteer fraud detection checks...");
    
    // Run the check manually for all volunteers
    const allVolunteers = await prisma.user.findMany({
        where: { role: Role.VOLUNTEER }
    });

    for (const volunteer of allVolunteers) {
        await runVolunteerCheck(volunteer.id);
    }

    console.log("✓ Volunteer fraud detection checks completed");

    console.log("\n═══════════════════════════════════════════════════");
    console.log("SEED COMPLETE - Demo Data Summary:");
    console.log("═══════════════════════════════════════════════════");
    console.log("Admin: admin@core.local / Admin@12345");
    console.log("Users: alice@, bob@, carol@, david@, eve@, frank@ / User@12345");
    console.log("Volunteers:");
    console.log("  - Sarah (Good): 5★ rating, no flags");
    console.log("  - Mike (Flagged): 1.6★ avg, flagged for low rating");
    console.log("  - Tom (Flagged): fraud keywords detected");
    console.log("═══════════════════════════════════════════════════\n");
}

async function runVolunteerCheck(volunteerId: string) {
    const FRAUD_KEYWORDS = [
        "scam", "fake", "fraud", "not present", "took supplies",
        "stole", "liar", "dishonest", "corrupt", "bribe"
    ];
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

    if (totalReviews >= 5) {
        const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
        if (averageRating < 2.0) {
            volunteerFlagReasons.push(`Average rating below 2.0 (${averageRating.toFixed(2)} stars across ${totalReviews} reviews)`);
        }
    }

    if (totalReviews >= 3) {
        const reviewsWithFraudKeywords = reviews.filter(r =>
            FRAUD_KEYWORDS.some(keyword => r.text.toLowerCase().includes(keyword))
        ).length;
        const fraudPercentage = (reviewsWithFraudKeywords / totalReviews) * 100;
        if (fraudPercentage >= 40) {
            volunteerFlagReasons.push(`${fraudPercentage.toFixed(0)}% of reviews contain fraud indicators`);
        }
    }

    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    const recentNegativeReviews = reviews.filter(r =>
        !r.wouldWorkAgain && r.createdAt >= thirtyDaysAgo
    ).length;

    if (recentNegativeReviews >= 3) {
        volunteerFlagReasons.push(`${recentNegativeReviews} "Would not work again" responses in 30 days`);
    }

    const isFlagged = volunteerFlagReasons.length > 0;
    await prisma.user.update({
        where: { id: volunteerId },
        data: {
            isFlagged,
            volunteerFlagReasons
        }
    });
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
