import { PrismaClient } from "@prisma/client";
import { triggerDispatchAlertsForCrisis } from "./src/services/dispatchAlertService.js";

const prisma = new PrismaClient();

(async () => {
  try {
    const ayesha = await prisma.user.findFirst({
      where: { email: "ayesha.vol@core.local" }
    });
    if (!ayesha) {
      console.log("Ayesha not found");
      return;
    }

    // Ensure Ayesha has coordinates and is opted in!
    await prisma.user.update({
      where: { id: ayesha.id },
      data: { 
        dispatchOptIn: true,
        latitude: 23.8103, // Dhaka
        longitude: 90.4125 
      }
    });
    console.log("Opted Ayesha in. ID:", ayesha.id);

    // Create a crisis event right near her
    const crisis = await prisma.crisisEvent.create({
      data: {
        title: "TEST DISPATCH EMAIL EVENT " + Date.now(),
        incidentType: "EARTHQUAKE",
        severityLevel: "CRITICAL",
        status: "VERIFIED",
        locationText: "Dhaka Center",
        latitude: 23.8110,
        longitude: 90.4130,
        reportCount: 1,
        reporterCount: 1
      }
    });
    console.log("Generated Verified Crisis:", crisis.id);

    console.log("Triggering dispatch email module...");
    await triggerDispatchAlertsForCrisis(crisis.id);
    console.log("Done!");

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
