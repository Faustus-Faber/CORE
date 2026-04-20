import twilio from "twilio";
import { prisma } from "../lib/prisma.js";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

// Haversine distance formula (returns distance in km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function triggerAlertsForCrisis(crisisEventId: string) {
  try {
    const crisis = await prisma.crisisEvent.findUnique({
      where: { id: crisisEventId }
    });

    if (!crisis || (crisis.severityLevel !== "CRITICAL" && crisis.severityLevel !== "HIGH")) {
      return;
    }

    if (!crisis.latitude || !crisis.longitude) {
      console.log(`[Twilio Service] Crisis missing coordinates, skipping dispatch. ID: ${crisis.id}`);
      return;
    }

    // Find opted-in volunteers
    const volunteers = await prisma.user.findMany({
      where: {
        role: "VOLUNTEER",
        dispatchOptIn: true,
        isBanned: false
      }
    });

    // Enforce 15 km radius
    const volunteersInRange = volunteers.filter(vol => {
      if (!vol.latitude || !vol.longitude) return false;
      const distance = calculateDistance(crisis.latitude!, crisis.longitude!, vol.latitude, vol.longitude);
      return distance <= 15;
    });

    console.log(`[Twilio Service] Found ${volunteersInRange.length} volunteers in 15km range for crisis ${crisis.id}`);

    // Check rate limit and send
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sentCount = 0;

    for (const vol of volunteersInRange) {
      // Rate Limit: 10 SMS per 24 hours
      const logsToday = await prisma.smsLog.count({
        where: {
          userId: vol.id,
          createdAt: { gte: today }
        }
      });

      if (logsToday >= 10) {
        console.log(`[Twilio Service] Volunteer ${vol.id} hit 10 SMS limit, skipping.`);
        continue;
      }

      // Format SMS text
      const shortDesc = (crisis.sitRepText || crisis.title).substring(0, 100).trim();
      const textMessage = `[CORE DISPATCH ALERT]\n${crisis.severityLevel} Emergency: ${crisis.title}\nLoc: ${crisis.locationText || 'Unknown'}\n"${shortDesc}..."\nPlease check the app for dispatch action details.`;

      const maskPhone = (phone: string) => `****${phone.slice(-4)}`;

      let sendStatus = "SENT";
      let errorMsg: string | null = null;
      let sid: string | null = null;

      try {
        if (!twilioClient) {
          throw new Error("Twilio credentials not configured in .env");
        }
        
        // Ensure E.164 formats
        let toPhone = vol.phone;
        if (!toPhone.startsWith("+")) toPhone = `+${toPhone}`;

        const message = await twilioClient.messages.create({
          body: textMessage,
          from: TWILIO_PHONE_NUMBER,
          to: toPhone
        });
        sid = message.sid;
      } catch (err: any) {
        sendStatus = "FAILED";
        errorMsg = err.message || "Unknown Twilio error";
        console.warn(`[Twilio Service] SMS Dispatch fallback for ${vol.id}. Reverting to Mock. Reason: ${errorMsg}`);
      }

      // Log to SMS Log
      await prisma.smsLog.create({
        data: {
          userId: vol.id,
          crisisEventId: crisis.id,
          phoneMasked: maskPhone(vol.phone),
          status: sendStatus,
          errorMessage: errorMsg,
          twilioSid: sid
        }
      });

      sentCount++;
    }

    console.log(`[Twilio Service] Completed dispatch, sent ${sentCount} SMS alerts.`);

  } catch (err) {
    console.error("[Twilio Service] Failed to execute triggerAlertsForCrisis", err);
  }
}
