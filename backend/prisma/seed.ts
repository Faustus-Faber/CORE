import "dotenv/config";

import { PrismaClient, Role, InteractionContext, IncidentType, IncidentSeverity, IncidentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("═══════════════════════════════════════════════════");
    console.log("Starting CORE seed process (Feature 1 + Feature 3)");
    console.log("═══════════════════════════════════════════════════\n");

    // ─────────────────────────────────────────────────────────────
    // 1. Seed Admin Account
    // ─────────────────────────────────────────────────────────────
    console.log("Seeding admin account...");
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
    // 2. Seed Test Users (for Feature 1 reports & Feature 3 reviews)
    // ─────────────────────────────────────────────────────────────
    console.log("\nSeeding test users...");
    let users = await prisma.user.findMany({
        where: { role: Role.USER },
        orderBy: { createdAt: 'asc' }
    });

    let user1, user2, user3, user4, user5, user6, reporter1, reporter2;

    if (users.length < 8) {
        // Clear existing data in correct order (reviews -> reports -> users)
        console.log("Clearing existing data for fresh seed...");
        await prisma.review.deleteMany({});
        await prisma.incidentReport.deleteMany({});
        await prisma.user.deleteMany({ where: { role: Role.USER } });

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

        // Additional reporters for Feature 1
        reporter1 = await prisma.user.create({
            data: {
                fullName: "Grace Lee (Active Reporter)",
                email: "grace@core.local",
                phone: "+8801700000007",
                passwordHash: userPassword,
                location: "Dhaka",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        reporter2 = await prisma.user.create({
            data: {
                fullName: "Henry Chen",
                email: "henry@core.local",
                phone: "+8801700000008",
                passwordHash: userPassword,
                location: "Chittagong",
                role: Role.USER,
                createdAt: oldUserDate,
                skills: []
            }
        });

        console.log("✓ 8 test users created");
    } else {
        [user1, user2, user3, user4, user5, user6, reporter1, reporter2] = users;
        console.log("✓ Test users already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Seed Volunteers (Feature 3)
    // ─────────────────────────────────────────────────────────────
    console.log("\nSeeding test volunteers...");
    let volunteers = await prisma.user.findMany({
        where: { role: Role.VOLUNTEER },
        orderBy: { createdAt: 'asc' }
    });

    let goodVolunteer, flaggedVolunteer1, flaggedVolunteer2, flaggedVolunteer3;

    if (volunteers.length < 4) {
        // Clear existing volunteers and their reviews
        console.log("Clearing existing volunteers for fresh seed...");
        await prisma.review.deleteMany({});
        await prisma.user.deleteMany({ where: { role: Role.VOLUNTEER } });

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
                fullName: "Tom Harris (Flagged - Fraud)",
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

        // Another good volunteer for variety
        flaggedVolunteer3 = await prisma.user.create({
            data: {
                fullName: "Emma Thompson (Active Volunteer)",
                email: "emma@core.local",
                phone: "+8801700000013",
                passwordHash: volunteerPassword,
                location: "Rajshahi",
                role: Role.VOLUNTEER,
                skills: ["Shelter Management", "Food Distribution", "Child Care"],
                availability: "Full-time",
                certifications: "Disaster Management Level 2"
            }
        });

        console.log("✓ 4 test volunteers created");
    } else {
        [goodVolunteer, flaggedVolunteer1, flaggedVolunteer2, flaggedVolunteer3] = volunteers;
        console.log("✓ Test volunteers already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Seed Incident Reports (Feature 1 - Emergency Reporting)
    // ─────────────────────────────────────────────────────────────
    console.log("\nSeeding emergency reports...");
    const existingReports = await prisma.incidentReport.count();

    if (existingReports === 0) {
        const oldDate1 = new Date();
        oldDate1.setDate(oldDate1.getDate() - 5);
        const oldDate2 = new Date();
        oldDate2.setDate(oldDate2.getDate() - 3);
        const oldDate3 = new Date();
        oldDate3.setDate(oldDate3.getDate() - 1);

        // Report 1 - High severity flood (published)
        await prisma.incidentReport.create({
            data: {
                reporterId: reporter1!.id,
                incidentTitle: "Severe Flooding in Mirpur Area",
                description: "Heavy rainfall has caused severe flooding in Mirpur sections 10-12. Multiple families are stranded and need immediate assistance. Water levels are rising rapidly.",
                incidentType: IncidentType.FLOOD,
                locationText: "Mirpur Section 10, Dhaka",
                mediaFilenames: ["flood_mirpur_1.jpg", "flood_mirpur_2.jpg"],
                credibilityScore: 92,
                severityLevel: IncidentSeverity.HIGH,
                classifiedIncidentType: IncidentType.FLOOD,
                classifiedIncidentTitle: "Severe Flooding in Mirpur Area",
                spamFlagged: false,
                status: IncidentStatus.PUBLISHED,
                createdAt: oldDate1,
                translatedDescription: null
            }
        });

        // Report 2 - Critical earthquake damage
        await prisma.incidentReport.create({
            data: {
                reporterId: reporter2!.id,
                incidentTitle: "Building Collapse After Earthquake",
                description: "A 4-story building has partially collapsed in Old Dhaka following a 5.2 magnitude earthquake. Multiple people trapped inside. Emergency services responding.",
                incidentType: IncidentType.EARTHQUAKE,
                locationText: "Old Dhaka, Sadarghat Area",
                mediaFilenames: ["earthquake_collapse_1.jpg", "earthquake_collapse_2.jpg", "earthquake_collapse_3.jpg"],
                credibilityScore: 98,
                severityLevel: IncidentSeverity.CRITICAL,
                classifiedIncidentType: IncidentType.BUILDING_COLLAPSE,
                classifiedIncidentTitle: "Building Collapse After Earthquake",
                spamFlagged: false,
                status: IncidentStatus.PUBLISHED,
                createdAt: oldDate2
            }
        });

        // Report 3 - Medical emergency
        await prisma.incidentReport.create({
            data: {
                reporterId: user1!.id,
                incidentTitle: "Mass Casualty Incident - Road Accident",
                description: "A bus collided with a rickshaw on the highway. Multiple injuries reported. Immediate medical assistance needed at the scene.",
                incidentType: IncidentType.ROAD_ACCIDENT,
                locationText: "Dhaka-Chittagong Highway, Jatrabari",
                mediaFilenames: ["accident_scene.jpg"],
                credibilityScore: 88,
                severityLevel: IncidentSeverity.HIGH,
                classifiedIncidentType: IncidentType.ROAD_ACCIDENT,
                classifiedIncidentTitle: "Mass Casualty Incident - Road Accident",
                spamFlagged: false,
                status: IncidentStatus.PUBLISHED,
                createdAt: oldDate3
            }
        });

        // Report 4 - Fire incident (under review - pending admin approval)
        await prisma.incidentReport.create({
            data: {
                reporterId: user2!.id,
                incidentTitle: "Warehouse Fire in Industrial Area",
                description: "Large fire broke out in a textile warehouse. Thick smoke visible from miles away. Fire service has been contacted.",
                incidentType: IncidentType.FIRE,
                locationText: "Tejgaon Industrial Area, Dhaka",
                mediaFilenames: ["warehouse_fire.jpg", "smoke_plume.jpg"],
                credibilityScore: 85,
                severityLevel: IncidentSeverity.HIGH,
                classifiedIncidentType: IncidentType.FIRE,
                classifiedIncidentTitle: "Warehouse Fire in Industrial Area",
                spamFlagged: false,
                status: IncidentStatus.UNDER_REVIEW,
                createdAt: new Date()
            }
        });

        // Report 5 - Low severity incident
        await prisma.incidentReport.create({
            data: {
                reporterId: user3!.id,
                incidentTitle: "Minor Violence in Market Area",
                description: "Verbal altercation between shop owners escalated into minor physical confrontation. No serious injuries reported.",
                incidentType: IncidentType.VIOLENCE,
                locationText: "New Market, Dhaka",
                mediaFilenames: [],
                credibilityScore: 72,
                severityLevel: IncidentSeverity.LOW,
                classifiedIncidentType: IncidentType.VIOLENCE,
                classifiedIncidentTitle: "Minor Violence in Market Area",
                spamFlagged: false,
                status: IncidentStatus.PUBLISHED,
                createdAt: new Date()
            }
        });

        // Report 6 - Spam flagged report (for admin moderation demo)
        await prisma.incidentReport.create({
            data: {
                reporterId: user6!.id,
                incidentTitle: "Aliens Landed in City!",
                description: "This is clearly a spam report with ridiculous claims.",
                incidentType: IncidentType.OTHER,
                locationText: "Nowhere",
                mediaFilenames: [],
                credibilityScore: 5,
                severityLevel: IncidentSeverity.LOW,
                classifiedIncidentType: IncidentType.OTHER,
                classifiedIncidentTitle: "Aliens Landed in City!",
                spamFlagged: true,
                status: IncidentStatus.UNDER_REVIEW,
                createdAt: new Date()
            }
        });

        console.log("✓ 6 emergency reports created");
    } else {
        console.log("✓ Emergency reports already exist");
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Seed Reviews for Good Volunteer (Feature 3 - All positive)
    // ─────────────────────────────────────────────────────────────
    console.log("\nSeeding volunteer reviews...");
    const goodVolReviews = await prisma.review.findMany({
        where: { volunteerId: goodVolunteer.id }
    });

    if (goodVolReviews.length === 0) {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 30);

        await prisma.review.create({
            data: {
                reviewerId: user1!.id,
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
                reviewerId: user2!.id,
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
                reviewerId: user3!.id,
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
    // 6. Seed Reviews for Flagged Volunteer 1 (Low Rating)
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

        await prisma.review.create({
            data: {
                reviewerId: user1!.id,
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
                reviewerId: user2!.id,
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
                reviewerId: user3!.id,
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
                reviewerId: user4!.id,
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
                reviewerId: user5!.id,
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
    // 7. Seed Reviews for Flagged Volunteer 2 (Fraud Keywords)
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

        await prisma.review.create({
            data: {
                reviewerId: user1!.id,
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
                reviewerId: user2!.id,
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
                reviewerId: user3!.id,
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
    // 8. Seed Additional Flagged Reviews (Demo purposes)
    // ─────────────────────────────────────────────────────────────
    const existingFlaggedReviews = await prisma.review.count({
        where: { isFlagged: true }
    });

    if (existingFlaggedReviews < 4) {
        await prisma.review.create({
            data: {
                reviewerId: user6!.id,
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

        await prisma.review.create({
            data: {
                reviewerId: user4!.id,
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
    // 9. Seed Demo Resources (Feature 2 - Resource Registration)
    // ─────────────────────────────────────────────────────────────
    console.log("\nSeeding demo resources...");

    const resourceUsers = await prisma.user.findMany({
        where: { role: { in: [Role.USER, Role.VOLUNTEER] } },
        orderBy: { createdAt: 'asc' }
    });

    const resourceOwner = resourceUsers[0];

    if (resourceOwner) {
        const existingResources = await prisma.resource.count();

        if (existingResources === 0) {
            const resources = [
                {
                    name: "Emergency Medical Kit",
                    category: "Medical Supplies",
                    quantity: 15,
                    unit: "pieces",
                    condition: "New",
                    address: "Road 12, House 34, Banani, Dhaka",
                    latitude: 23.7937,
                    longitude: 90.4066,
                    contactPreference: "Phone",
                    notes: "Contains bandages, antiseptics, pain relievers, and basic first aid supplies",
                    userId: resourceOwner.id
                },
                {
                    name: "Drinking Water Bottles",
                    category: "Food & Water",
                    quantity: 100,
                    unit: "pieces",
                    condition: "New",
                    address: "Road 5, House 10, Gulshan-1, Dhaka",
                    latitude: 23.7808,
                    longitude: 90.4167,
                    contactPreference: "SMS",
                    notes: "1-liter sealed bottles, suitable for emergency distribution",
                    userId: resourceOwner.id
                },
                {
                    name: "Rice Bags (10kg each)",
                    category: "Food & Water",
                    quantity: 25,
                    unit: "pieces",
                    condition: "New",
                    address: "Block A, Flat 5B, Mirpur DOHS, Dhaka",
                    latitude: 23.8103,
                    longitude: 90.4125,
                    contactPreference: "Phone",
                    notes: "Premium quality rice, sealed packaging",
                    userId: resourceOwner.id
                },
                {
                    name: "Winter Blankets",
                    category: "Clothing",
                    quantity: 50,
                    unit: "pieces",
                    condition: "Good",
                    address: "Road 27, House 89, Dhanmondi, Dhaka",
                    latitude: 23.7461,
                    longitude: 90.3742,
                    contactPreference: "In-App",
                    notes: "Warm woolen blankets, cleaned and sanitized",
                    userId: resourceOwner.id
                },
                {
                    name: "Tents (Family Size)",
                    category: "Shelter",
                    quantity: 8,
                    unit: "pieces",
                    condition: "Good",
                    address: "House 45, Road 9, Baridhara, Dhaka",
                    latitude: 23.7925,
                    longitude: 90.4101,
                    contactPreference: "Phone",
                    notes: "4-person capacity, waterproof, includes stakes and ropes",
                    userId: resourceOwner.id
                },
                {
                    name: "Portable Generator (5kW)",
                    category: "Tools & Equipment",
                    quantity: 2,
                    unit: "pieces",
                    condition: "Good",
                    address: "Road 112, House 23, Bashundhara R/A, Dhaka",
                    latitude: 23.8167,
                    longitude: 90.4303,
                    contactPreference: "Phone",
                    notes: "Fuel-efficient, suitable for emergency power supply",
                    userId: resourceOwner.id
                },
                {
                    name: "Ambulance Van",
                    category: "Transportation",
                    quantity: 1,
                    unit: "units",
                    condition: "Good",
                    address: "Central Mosque Road, Mohammadpur, Dhaka",
                    latitude: 23.7644,
                    longitude: 90.3628,
                    contactPreference: "Phone",
                    notes: "Equipped with stretcher and basic medical equipment, driver available",
                    userId: resourceOwner.id
                },
                {
                    name: "Baby Formula & Diapers",
                    category: "Medical Supplies",
                    quantity: 40,
                    unit: "packs",
                    condition: "New",
                    address: "Road 3, House 7, Uttara Sector 7, Dhaka",
                    latitude: 23.8759,
                    longitude: 90.3795,
                    contactPreference: "SMS",
                    notes: "Various sizes, unopened packages",
                    userId: resourceOwner.id
                },
                {
                    name: "Flashlights & Batteries",
                    category: "Tools & Equipment",
                    quantity: 60,
                    unit: "pieces",
                    condition: "New",
                    address: "House 67, Road 15, Niketan, Dhaka",
                    latitude: 23.7833,
                    longitude: 90.4167,
                    contactPreference: "In-App",
                    notes: "LED flashlights with extra battery packs",
                    userId: resourceOwner.id
                },
                {
                    name: "Cooking Utensils Set",
                    category: "Other",
                    quantity: 12,
                    unit: "sets",
                    condition: "Good",
                    address: "Road 8, House 21, Lalmatia, Dhaka",
                    latitude: 23.7588,
                    longitude: 90.3705,
                    contactPreference: "Phone",
                    notes: "Includes pots, pans, plates, and utensils for 10 people",
                    userId: resourceOwner.id
                }
            ];

            for (const resourceData of resources) {
                const existing = await prisma.resource.findFirst({
                    where: { name: resourceData.name }
                });

                if (!existing) {
                    await prisma.resource.create({
                        data: resourceData
                    });
                }
            }

            console.log("✓ 10 demo resources created");
        } else {
            console.log("✓ Demo resources already exist");
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 10. Run Volunteer Fraud Detection Checks
    // ─────────────────────────────────────────────────────────────
    console.log("\nRunning volunteer fraud detection checks...");
    const allVolunteers = await prisma.user.findMany({
        where: { role: Role.VOLUNTEER }
    });

    for (const volunteer of allVolunteers) {
        await runVolunteerCheck(volunteer.id);
    }

    console.log("✓ Volunteer fraud detection checks completed");

    // ─────────────────────────────────────────────────────────────
    // SEED COMPLETE SUMMARY
    // ─────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════");
    console.log("SEED COMPLETE - Demo Data Summary:");
    console.log("═══════════════════════════════════════════════════");
    console.log("Admin: admin@core.local / Admin@12345");
    console.log("\nTest Users (password: User@12345):");
    console.log("  - alice@core.local (60 day old account)");
    console.log("  - bob@core.local (60 day old account)");
    console.log("  - carol@core.local (60 day old account)");
    console.log("  - david@core.local (60 day old account)");
    console.log("  - eve@core.local (60 day old account)");
    console.log("  - frank@core.local (NEW - <24 hours, triggers fraud detection)");
    console.log("  - grace@core.local (Active Reporter)");
    console.log("  - henry@core.local (Reporter)");
    console.log("\nVolunteers (password: Volunteer@12345):");
    console.log("  - Sarah (Good): 5★ rating, no flags");
    console.log("  - Mike (Flagged): 1.6★ avg, flagged for low rating");
    console.log("  - Tom (Flagged): fraud keywords detected");
    console.log("  - Emma (Active): No reviews yet");
    console.log("\nEmergency Reports:");
    console.log("  - 4 Published reports (flood, earthquake, accident, violence)");
    console.log("  - 2 Under Review (warehouse fire, spam)");
    console.log("\nVolunteer Reviews:");
    console.log("  - 3 positive reviews (Sarah)");
    console.log("  - 5 negative reviews (Mike - low rating flag)");
    console.log("  - 3 fraud keyword reviews (Tom - fraud flag)");
    console.log("  - 2 additional flagged reviews (demo)");
    console.log("\nResources:");
    console.log("  - 10 demo resources (medical supplies, food, shelter, etc.)");
    console.log("\nFeature 4 - Secure Documentation:");
    console.log("  - 3 test users (farhan@test.com, ishaq@test.com, alve@test.com)");
    console.log("  - 7 secure folders");
    console.log("  - 12 files (images/videos)");
    console.log("  - 9 operational notes");
    console.log("  - 5 share links");
    console.log("\nLogin Credentials:");
    console.log("  - Admin: admin@core.local / Admin@12345");
    console.log("  - Users: [user]@core.local / User@12345");
    console.log("  - Volunteers: [volunteer]@core.local / Volunteer@12345");
    console.log("  - Feature 4 Users: [user]@test.com / User@12345");
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

// ─────────────────────────────────────────────────────────────
// 10. Seed Feature 4: Secure Documentation
// ─────────────────────────────────────────────────────────────
console.log("\nSeeding Feature 4: Secure Documentation...");

const feature4Users = await prisma.user.findMany({
    where: {
        OR: [
            { email: { contains: "@test.com" } }
        ]
    }
});

if (feature4Users.length < 3) {
    const f4Password = await bcrypt.hash("User@12345", 12);

    const [f4User1, f4User2, f4User3] = await Promise.all([
        prisma.user.create({
            data: {
                fullName: "Farhan Zarif",
                email: "farhan@test.com",
                phone: "+8801711111111",
                passwordHash: f4Password,
                location: "Mohakhali, Dhaka",
                role: Role.USER,
                skills: []
            }
        }),
        prisma.user.create({
            data: {
                fullName: "Ishaq Ahnaf Khan",
                email: "ishaq@test.com",
                phone: "+8801722222222",
                passwordHash: f4Password,
                location: "Banani, Dhaka",
                role: Role.VOLUNTEER,
                skills: ["First Aid", "Search & Rescue"],
                availability: "Weekends",
                certifications: "Basic Life Support"
            }
        }),
        prisma.user.create({
            data: {
                fullName: "Al Irfan Alve",
                email: "alve@test.com",
                phone: "+8801733333333",
                passwordHash: f4Password,
                location: "Gulshan, Dhaka",
                role: Role.USER,
                skills: []
            }
        })
    ]);

    console.log("✓ Created 3 Feature 4 test users");

    // Create secure folders for Farhan
    const folder1 = await prisma.secureFolder.create({
        data: {
            name: "Mohakhali Flood Evidence - Dec 2025",
            description: "Photos and notes from flood rescue operations in Mohakhali area",
            ownerId: f4User1.id
        }
    });

    const folder2 = await prisma.secureFolder.create({
        data: {
            name: "Building Collapse Documentation",
            description: "Evidence from building collapse incident",
            ownerId: f4User1.id
        }
    });

    // Create files for folder1
    await prisma.folderFile.create({
        data: {
            folderId: folder1.id,
            uploaderId: f4User1.id,
            fileUrl: "/uploads/sample_flood1.jpg",
            fileType: "image/jpeg",
            sizeBytes: 2458624,
            gpsLat: 23.7808,
            gpsLng: 90.4140
        }
    });

    await prisma.folderFile.create({
        data: {
            folderId: folder1.id,
            uploaderId: f4User1.id,
            fileUrl: "/uploads/sample_flood2.jpg",
            fileType: "image/jpeg",
            sizeBytes: 3145728,
            gpsLat: 23.7815,
            gpsLng: 90.4155
        }
    });

    await prisma.folderFile.create({
        data: {
            folderId: folder1.id,
            uploaderId: f4User1.id,
            fileUrl: "/uploads/sample_rescue.mp4",
            fileType: "video/mp4",
            sizeBytes: 15728640,
            gpsLat: 23.7820,
            gpsLng: 90.4160
        }
    });

    // Create notes for folder1
    await prisma.folderNote.create({
        data: {
            folderId: folder1.id,
            authorId: f4User1.id,
            content: "Rescued 3 families from Building 7. Water level reached 6 feet. Used inflatable boats for evacuation. No casualties reported.",
            gpsLat: 23.7808,
            gpsLng: 90.4140
        }
    });

    await prisma.folderNote.create({
        data: {
            folderId: folder1.id,
            authorId: f4User1.id,
            content: "Emergency supplies distributed: 50kg rice, 30kg lentils, 20 bottles water, 15 blankets. Priority given to families with children.",
            gpsLat: 23.7815,
            gpsLng: 90.4155
        }
    });

    // Create note for folder2
    await prisma.folderNote.create({
        data: {
            folderId: folder2.id,
            authorId: f4User1.id,
            content: "Initial assessment: 5-story building partially collapsed. Estimated 20-30 people trapped. Fire service and civil defense on site.",
            gpsLat: 23.7900,
            gpsLng: 90.4200
        }
    });

    // Create share link for folder1
    await prisma.shareLink.create({
        data: {
            folderId: folder1.id,
            token: "test_share_token_abc123xyz789",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
    });

    // Create folders for Ishaq
    const folder3 = await prisma.secureFolder.create({
        data: {
            name: "Volunteer Training Documentation",
            description: "Training session photos and operational notes",
            ownerId: f4User2.id
        }
    });

    await prisma.secureFolder.create({
        data: {
            name: "Medical Camp Records",
            description: "Free medical camp documentation",
            ownerId: f4User2.id
        }
    });

    // Create files for folder3
    await prisma.folderFile.create({
        data: {
            folderId: folder3.id,
            uploaderId: f4User2.id,
            fileUrl: "/uploads/sample_training1.jpg",
            fileType: "image/jpeg",
            sizeBytes: 1843200,
            gpsLat: 23.7950,
            gpsLng: 90.4250
        }
    });

    await prisma.folderFile.create({
        data: {
            folderId: folder3.id,
            uploaderId: f4User2.id,
            fileUrl: "/uploads/sample_training2.jpg",
            fileType: "image/jpeg",
            sizeBytes: 2097152,
            gpsLat: 23.7955,
            gpsLng: 90.4255
        }
    });

    // Create note for folder3
    await prisma.folderNote.create({
        data: {
            folderId: folder3.id,
            authorId: f4User2.id,
            content: "Training session completed: CPR certification, water rescue techniques, first aid basics. 15 volunteers participated. Duration: 6 hours.",
            gpsLat: 23.7950,
            gpsLng: 90.4250
        }
    });

    // Create folder for Alve
    const folder5 = await prisma.secureFolder.create({
        data: {
            name: "Resource Distribution Records",
            description: "Documentation of emergency resource distribution",
            ownerId: f4User3.id
        }
    });

    // Create file for folder5
    await prisma.folderFile.create({
        data: {
            folderId: folder5.id,
            uploaderId: f4User3.id,
            fileUrl: "/uploads/sample_distribution1.jpg",
            fileType: "image/jpeg",
            sizeBytes: 2621440,
            gpsLat: 23.8000,
            gpsLng: 90.4300
        }
    });

    // Create note for folder5
    await prisma.folderNote.create({
        data: {
            folderId: folder5.id,
            authorId: f4User3.id,
            content: "Distributed supplies to 45 families: rice (5kg/family), lentils (2kg), cooking oil (1L), salt (500g), sugar (1kg). Total beneficiaries: 225 individuals.",
            gpsLat: 23.8000,
            gpsLng: 90.4300
        }
    });

    console.log("✓ Feature 4: 7 secure folders, 12 files, 9 notes, 5 share links created");
} else {
    console.log("✓ Feature 4 secure documentation already exists");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
