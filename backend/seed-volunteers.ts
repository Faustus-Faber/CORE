import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding volunteers...");
    const dummyPasswordHash = await bcrypt.hash("password123", 10);

    // Provide explicit default values for interactions explicitly to avoid Prisma schema errors
    const interactionContext = "MEDICAL_AID"; // Use a valid enum InteractionContext
    const now = new Date();

    // 1. Sadia Noshin
    const sadia = await prisma.user.upsert({
        where: { email: "sadia@example.com" },
        update: {
            latitude: 23.7805,
            longitude: 90.4267,
            availability: "Available",
            skills: ["Medical", "First Aid"],
            isFlagged: false
        },
        create: {
            fullName: "Sadia Noshin",
            email: "sadia@example.com",
            phone: "+880179999000" + Math.floor(Math.random() * 1000).toString(),
            passwordHash: dummyPasswordHash,
            location: "Badda, Dhaka",
            latitude: 23.7805,
            longitude: 90.4267,
            role: "VOLUNTEER",
            availability: "Available",
            skills: ["Medical", "First Aid"],
            isFlagged: false
        }
    });

    // 2. MD Kafi
    const kafi = await prisma.user.upsert({
        where: { email: "kafi@example.com" },
        update: {
            latitude: 23.7461,
            longitude: 90.3742,
            availability: "Busy",
            skills: ["Logistics", "Communications"],
            isFlagged: false,
        },
        create: {
            fullName: "MD Kafi",
            email: "kafi@example.com",
            phone: "+880179999000" + Math.floor(Math.random() * 1000).toString(),
            passwordHash: dummyPasswordHash,
            location: "Dhanmondi, Dhaka",
            latitude: 23.7461,
            longitude: 90.3742,
            role: "VOLUNTEER",
            availability: "Busy",
            skills: ["Logistics", "Communications"],
            isFlagged: false
        }
    });

    // 3. Sultana Mary
    const mary = await prisma.user.upsert({
        where: { email: "sultana@example.com" },
        update: {
            latitude: 23.8223,
            longitude: 90.3654,
            availability: "Available",
            skills: ["Search & Rescue", "Shelter"],
            isFlagged: true,
            volunteerFlagReasons: ["Missed 3 shifts without notice"]
        },
        create: {
            fullName: "Sultana Mary",
            email: "sultana@example.com",
            phone: "+880179999000" + Math.floor(Math.random() * 1000).toString(),
            passwordHash: dummyPasswordHash,
            location: "Mirpur, Dhaka",
            latitude: 23.8223,
            longitude: 90.3654,
            role: "VOLUNTEER",
            availability: "Available",
            skills: ["Search & Rescue", "Shelter"],
            isFlagged: true,
            volunteerFlagReasons: ["Missed 3 shifts without notice"]
        }
    });

    // Dummy Reviewer
    const reviewer = await prisma.user.upsert({
        where: { email: "reviewer@example.com" },
        update: {},
        create: {
            fullName: "Demo Reviewer",
            email: "reviewer@example.com",
            phone: "+880179999000" + Math.floor(Math.random() * 1000).toString(),
            passwordHash: dummyPasswordHash,
            location: "Banani, Dhaka",
            role: "USER"
        }
    });

    // Add a couple of reviews to test the trust rating!
    await prisma.review.createMany({
        data: [
            {
                reviewerId: reviewer.id,
                volunteerId: sadia.id,
                rating: 5,
                text: "Sadia was incredibly helpful during the medical emergency.",
                interactionContext: interactionContext,
                interactionDate: now,
                wouldWorkAgain: true,
            },
            {
                reviewerId: reviewer.id,
                volunteerId: mary.id,
                rating: 2,
                text: "Was somewhat helpful but arrived very late.",
                interactionContext: "RESCUE_OPERATION",
                interactionDate: now,
                wouldWorkAgain: false,
            }
        ]
    }).catch(e => console.log("Reviews already seed or error (ignoring if unique constraint)"));

    console.log("Mock Volunteers Successfully Created!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
