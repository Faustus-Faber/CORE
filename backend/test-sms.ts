import { PrismaClient } from '@prisma/client';
import { triggerAlertsForCrisis } from './src/services/twilioService.js';

const prisma = new PrismaClient();

(async () => {
  try {
    const ayesha = await prisma.user.findFirst({ where: { email: 'ayesha.vol@core.local' } });
    if (!ayesha) { console.log('Ayesha not found'); return; }

    // Ensure Ayesha has coordinates and is opted in!
    await prisma.user.update({
      where: { id: ayesha.id },
      data: { 
        dispatchOptIn: true, 
        latitude: 23.8103, // Dhaka
        longitude: 90.4125 
      }
    });
    console.log('Opted Ayesha in. ID:', ayesha.id);

    // Create a crisis event right near her
    const crisis = await prisma.crisisEvent.create({
      data: {
        title: 'TEST DISPATCH SMS EVENT ' + Date.now(),
        incidentType: 'EARTHQUAKE',
        severityLevel: 'CRITICAL',
        status: 'VERIFIED',
        locationText: 'Dhaka Center',
        latitude: 23.8110,
        longitude: 90.4130,
        reportCount: 1,
        reporterCount: 1
      }
    });
    console.log('Generated Verified Crisis:', crisis.id);

    console.log('Triggering Twilio Module...');
    // Programmatically fire the service logic exactly as if Admin just hit "Verify"
    await triggerAlertsForCrisis(crisis.id);
    console.log('Done!');

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
