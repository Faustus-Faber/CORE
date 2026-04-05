import "dotenv/config";

import { PrismaClient, Role, IncidentType, IncidentSeverity, IncidentStatus, CrisisEventStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("═══════════════════════════════════════════════════");
    console.log("Seeding additional clusters for Intelligence Briefing demo");
    console.log("═══════════════════════════════════════════════════\n");

    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    if (!admin) {
        console.log("ERROR: Admin user not found. Run main seed first.");
        process.exit(1);
    }

    const users = await prisma.user.findMany({
        where: { role: { in: [Role.USER, Role.VOLUNTEER] } },
        orderBy: { createdAt: "asc" }
    });

    const reporter1 = users[0];
    const reporter2 = users[1];
    const reporter3 = users[2];

    const now = new Date();
    const recentDate = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHrAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fourHrAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    // ── Cluster 9: Medical Emergency ─────────────────────────
    const medReport1 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter1.id,
            incidentTitle: "Heart Attack at Shopping Mall",
            description: "Elderly person collapsed at Jamuna Future Park. Ambulance called. Crowd gathering at main entrance.",
            incidentType: IncidentType.MEDICAL_EMERGENCY,
            locationText: "Jamuna Future Park, Gulshan, Dhaka",
            latitude: 23.8045,
            longitude: 90.4234,
            mediaFilenames: [],
            credibilityScore: 94,
            severityLevel: IncidentSeverity.CRITICAL,
            classifiedIncidentType: IncidentType.MEDICAL_EMERGENCY,
            classifiedIncidentTitle: "Heart Attack at Shopping Mall",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: recentDate
        }
    });

    const medReport2 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter2.id,
            incidentTitle: "Medical Emergency at Gulshan Mall",
            description: "Person unconscious on second floor. Security has cordoned off the area. Medical team requested.",
            incidentType: IncidentType.MEDICAL_EMERGENCY,
            locationText: "Jamuna Future Park, Level 2, Dhaka",
            latitude: 23.8048,
            longitude: 90.4238,
            mediaFilenames: [],
            credibilityScore: 89,
            severityLevel: IncidentSeverity.CRITICAL,
            classifiedIncidentType: IncidentType.MEDICAL_EMERGENCY,
            classifiedIncidentTitle: "Medical Emergency at Gulshan Mall",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: twoHrAgo
        }
    });

    await prisma.crisisEvent.create({
        data: {
            title: "Medical Emergency at Jamuna Future Park",
            incidentType: IncidentType.MEDICAL_EMERGENCY,
            severityLevel: IncidentSeverity.CRITICAL,
            locationText: "Jamuna Future Park, Gulshan, Dhaka",
            latitude: 23.8045,
            longitude: 90.4234,
            status: CrisisEventStatus.ACTIVE,
            sitRepText: "Cardiac arrest reported at shopping mall. Emergency services en route. Main entrance area cordoned off by security.",
            reportCount: 2,
            reporterCount: 2
        }
    }).then(async (ce) => {
        await prisma.crisisEventReport.createMany({
            data: [
                { crisisEventId: ce.id, incidentReportId: medReport1.id },
                { crisisEventId: ce.id, incidentReportId: medReport2.id }
            ]
        });
        console.log(`✓ CrisisEvent 9: Medical Emergency (CRITICAL, 2 reports merged)`);
    });

    // ── Cluster 10: Fire in Commercial Area ──────────────────
    const fireReport1 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter3.id,
            incidentTitle: "Kitchen Fire in Restaurant",
            description: "Fire broke out in kitchen of a busy restaurant in Dhanmondi. Fire service called. Patrons evacuated safely.",
            incidentType: IncidentType.FIRE,
            locationText: "Dhanmondi Road 27, Dhaka",
            latitude: 23.7465,
            longitude: 90.3750,
            mediaFilenames: [],
            credibilityScore: 91,
            severityLevel: IncidentSeverity.HIGH,
            classifiedIncidentType: IncidentType.FIRE,
            classifiedIncidentTitle: "Kitchen Fire in Restaurant",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: fourHrAgo
        }
    });

    const fireReport2 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter1.id,
            incidentTitle: "Smoke from Restaurant in Dhanmondi",
            description: "Thick black smoke visible from Dhanmondi Road 27. Multiple fire trucks arriving on scene.",
            incidentType: IncidentType.FIRE,
            locationText: "Dhanmondi Road 27, Near Lake Circus, Dhaka",
            latitude: 23.7460,
            longitude: 90.3755,
            mediaFilenames: [],
            credibilityScore: 88,
            severityLevel: IncidentSeverity.HIGH,
            classifiedIncidentType: IncidentType.FIRE,
            classifiedIncidentTitle: "Smoke from Restaurant in Dhanmondi",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: twoHrAgo
        }
    });

    const fireReport3 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter2.id,
            incidentTitle: "Fire Contained in Kitchen Area",
            description: "Fire department confirms kitchen fire is being contained. No casualties reported. Building evacuation complete.",
            incidentType: IncidentType.FIRE,
            locationText: "Dhanmondi Road 27, Dhaka",
            latitude: 23.7462,
            longitude: 90.3748,
            mediaFilenames: [],
            credibilityScore: 95,
            severityLevel: IncidentSeverity.MEDIUM,
            classifiedIncidentType: IncidentType.FIRE,
            classifiedIncidentTitle: "Fire Contained in Kitchen Area",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: recentDate
        }
    });

    await prisma.crisisEvent.create({
        data: {
            title: "Restaurant Fire in Dhanmondi",
            incidentType: IncidentType.FIRE,
            severityLevel: IncidentSeverity.HIGH,
            locationText: "Dhanmondi Road 27, Dhaka",
            latitude: 23.7465,
            longitude: 90.3750,
            status: CrisisEventStatus.ACTIVE,
            sitRepText: "Kitchen fire at Dhanmondi restaurant. Fire service on scene. All patrons evacuated. Fire being contained. No injuries reported.",
            reportCount: 3,
            reporterCount: 3
        }
    }).then(async (ce) => {
        await prisma.crisisEventReport.createMany({
            data: [
                { crisisEventId: ce.id, incidentReportId: fireReport1.id },
                { crisisEventId: ce.id, incidentReportId: fireReport2.id },
                { crisisEventId: ce.id, incidentReportId: fireReport3.id }
            ]
        });
        console.log(`✓ CrisisEvent 10: Restaurant Fire (HIGH, 3 reports merged)`);
    });

    // ── Cluster 11: Violence in Campus Area ──────────────────
    const vioReport1 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter3.id,
            incidentTitle: "Student Clash at University Campus",
            description: "Large group of students engaged in physical altercation at Dhaka University campus near Arts Building. Police called.",
            incidentType: IncidentType.VIOLENCE,
            locationText: "Dhaka University, Arts Building Area",
            latitude: 23.7325,
            longitude: 90.3930,
            mediaFilenames: [],
            credibilityScore: 86,
            severityLevel: IncidentSeverity.MEDIUM,
            classifiedIncidentType: IncidentType.VIOLENCE,
            classifiedIncidentTitle: "Student Clash at University Campus",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: twoHrAgo
        }
    });

    await prisma.crisisEvent.create({
        data: {
            title: "Student Altercation at Dhaka University",
            incidentType: IncidentType.VIOLENCE,
            severityLevel: IncidentSeverity.MEDIUM,
            locationText: "Dhaka University, Arts Building Area",
            latitude: 23.7325,
            longitude: 90.3930,
            status: CrisisEventStatus.CONTAINED,
            sitRepText: "Student altercation at university campus. Police have intervened. Situation being monitored. No serious injuries reported.",
            reportCount: 1,
            reporterCount: 1
        }
    }).then(async (ce) => {
        await prisma.crisisEventReport.create({
            data: { crisisEventId: ce.id, incidentReportId: vioReport1.id }
        });
        console.log(`✓ CrisisEvent 11: Campus Altercation (MEDIUM, 1 report)`);
    });

    // ── Cluster 12: Building Collapse (New) ──────────────────
    const bcReport1 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter1.id,
            incidentTitle: "Structural Cracks in Old Building",
            description: "Major cracks appeared in walls of 5-story building in Old Dhaka. Residents evacuated. Building deemed unsafe.",
            incidentType: IncidentType.BUILDING_COLLAPSE,
            locationText: "Chawk Bazar, Old Dhaka",
            latitude: 23.7150,
            longitude: 90.3980,
            mediaFilenames: [],
            credibilityScore: 93,
            severityLevel: IncidentSeverity.CRITICAL,
            classifiedIncidentType: IncidentType.BUILDING_COLLAPSE,
            classifiedIncidentTitle: "Structural Cracks in Old Building",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: fourHrAgo
        }
    });

    const bcReport2 = await prisma.incidentReport.create({
        data: {
            reporterId: reporter3.id,
            incidentTitle: "Partial Collapse of Building Wing",
            description: "One wing of the building has partially collapsed. No one inside as building was already evacuated. RAJF inspecting.",
            incidentType: IncidentType.BUILDING_COLLAPSE,
            locationText: "Chawk Bazar, Old Dhaka",
            latitude: 23.7148,
            longitude: 90.3975,
            mediaFilenames: [],
            credibilityScore: 96,
            severityLevel: IncidentSeverity.CRITICAL,
            classifiedIncidentType: IncidentType.BUILDING_COLLAPSE,
            classifiedIncidentTitle: "Partial Collapse of Building Wing",
            spamFlagged: false,
            status: IncidentStatus.PUBLISHED,
            createdAt: recentDate
        }
    });

    await prisma.crisisEvent.create({
        data: {
            title: "Building Structural Failure in Chawk Bazar",
            incidentType: IncidentType.BUILDING_COLLAPSE,
            severityLevel: IncidentSeverity.CRITICAL,
            locationText: "Chawk Bazar, Old Dhaka",
            latitude: 23.7150,
            longitude: 90.3980,
            status: CrisisEventStatus.ACTIVE,
            sitRepText: "Building structural failure in Chawk Bazar. One wing collapsed. All residents previously evacuated. RAJF conducting safety inspection. Area cordoned off.",
            reportCount: 2,
            reporterCount: 2
        }
    }).then(async (ce) => {
        await prisma.crisisEventReport.createMany({
            data: [
                { crisisEventId: ce.id, incidentReportId: bcReport1.id },
                { crisisEventId: ce.id, incidentReportId: bcReport2.id }
            ]
        });
        console.log(`✓ CrisisEvent 12: Building Failure (CRITICAL, 2 reports merged)`);
    });

    console.log("\n═══════════════════════════════════════════════════");
    console.log("4 new CrisisEvents created with 8 additional reports");
    console.log("═══════════════════════════════════════════════════");
    console.log("\nUpdated CrisisEvent Summary:");
    console.log("  1. Severe Flooding in Mirpur (HIGH)");
    console.log("  2. Building Collapse After Earthquake (CRITICAL)");
    console.log("  3. Mass Casualty - Road Accident (HIGH)");
    console.log("  4. Minor Violence in Market (LOW, RESOLVED)");
    console.log("  5. Waterlogging in Gulshan (MEDIUM)");
    console.log("  6. Power Outage in Uttara (LOW)");
    console.log("  7. Gas Leak Warning in Banani (HIGH)");
    console.log("  8. River Bank Erosion in Turag (CRITICAL)");
    console.log("  9. Medical Emergency at Jamuna Future Park (CRITICAL) ← NEW");
    console.log("  10. Restaurant Fire in Dhanmondi (HIGH) ← NEW");
    console.log("  11. Campus Altercation at DU (MEDIUM, CONTAINED) ← NEW");
    console.log("  12. Building Failure in Chawk Bazar (CRITICAL) ← NEW");
    console.log("\nRefresh the dashboard to see updated Intelligence Briefing.");
    console.log("═══════════════════════════════════════════════════\n");
}

main()
    .catch((e) => {
        console.error("Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });