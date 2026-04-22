import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { haversineDistanceKm } from "../utils/geo.js";

const ALERT_RADIUS_KM = 15;
const MAX_ALERTS_PER_24_HOURS = 10;

type DispatchResult = {
  status: "SENT" | "FAILED";
  providerMessageId: string | null;
  errorMessage: string | null;
};

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "****";
  const visible = name.slice(0, 2);
  return `${visible}****@${domain}`;
}

function formatDispatchEmailBody(input: {
  title: string;
  severityLevel: string;
  locationText: string;
  sitRepText: string | null;
  crisisEventId: string;
}): string {
  const shortSummary = (input.sitRepText ?? input.title).slice(0, 180).trim();

  return [
    "[CORE DISPATCH ALERT]",
    "",
    `Severity: ${input.severityLevel}`,
    `Incident: ${input.title}`,
    `Location: ${input.locationText || "Unknown"}`,
    "",
    `Summary: ${shortSummary}${shortSummary.endsWith(".") ? "" : "..."}`,
    "",
    "Suggested Action: Confirm availability and proceed only if safe.",
    `Open Crisis Card: ${env.corsOrigins[0]}/dashboard/incidents/${input.crisisEventId}`
  ].join("\n");
}

async function sendDispatchEmail(
  recipientEmail: string,
  emailPayload: {
    subject: string;
    body: string;
  }
): Promise<DispatchResult> {
  if (!env.resendApiKey) {
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: "Resend API key is not configured"
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to: [recipientEmail],
        subject: emailPayload.subject,
        text: emailPayload.body
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok) {
      return {
        status: "FAILED",
        providerMessageId: null,
        errorMessage:
          payload.error?.message ??
          payload.message ??
          `Dispatch email failed with status ${response.status}`
      };
    }

    return {
      status: "SENT",
      providerMessageId: payload.id ?? null,
      errorMessage: null
    };
  } catch (error) {
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: error instanceof Error ? error.message : "Unknown dispatch error"
    };
  }
}

export async function triggerDispatchAlertsForCrisis(
  crisisEventId: string
): Promise<void> {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId }
  });

  if (!crisis) return;
  if (!["CRITICAL", "HIGH"].includes(crisis.severityLevel)) return;
  if (crisis.latitude == null || crisis.longitude == null) return;

  const volunteers = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      dispatchOptIn: true,
      isBanned: false
    },
    select: {
      id: true,
      email: true,
      latitude: true,
      longitude: true
    }
  });

  const inRangeVolunteers = volunteers.filter((volunteer) => {
    if (volunteer.latitude == null || volunteer.longitude == null) return false;
    return (
      haversineDistanceKm(
        crisis.latitude!,
        crisis.longitude!,
        volunteer.latitude,
        volunteer.longitude
      ) <= ALERT_RADIUS_KM
    );
  });

  if (inRangeVolunteers.length === 0) return;

  const now = Date.now();
  const lookback = new Date(now - 24 * 60 * 60 * 1000);

  for (const volunteer of inRangeVolunteers) {
    const sentRecently = await prisma.dispatchAlertLog.count({
      where: {
        userId: volunteer.id,
        createdAt: { gte: lookback }
      }
    });

    if (sentRecently >= MAX_ALERTS_PER_24_HOURS) {
      continue;
    }

    const subject = `[CORE DISPATCH ALERT] ${crisis.severityLevel} ${crisis.title}`;
    const body = formatDispatchEmailBody({
      title: crisis.title,
      severityLevel: crisis.severityLevel,
      locationText: crisis.locationText,
      sitRepText: crisis.sitRepText,
      crisisEventId: crisis.id
    });

    const dispatch = await sendDispatchEmail(volunteer.email, { subject, body });

    await prisma.dispatchAlertLog.create({
      data: {
        userId: volunteer.id,
        crisisEventId: crisis.id,
        emailMasked: maskEmail(volunteer.email),
        status: dispatch.status,
        providerMessageId: dispatch.providerMessageId,
        errorMessage: dispatch.errorMessage
      }
    });
  }
}
