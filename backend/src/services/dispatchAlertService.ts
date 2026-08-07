import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { metrics } from "../utils/metrics.js";

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
  if (!env.brevoApiKey) {
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: "Brevo API key is not configured"
    };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: { name: env.brevoFromName, email: env.brevoFromEmail },
        to: [{ email: recipientEmail }],
        subject: emailPayload.subject,
        textContent: emailPayload.body
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
      code?: string;
    };

    if (!response.ok) {
      return {
        status: "FAILED",
        providerMessageId: null,
        errorMessage:
          payload.message ?? `Dispatch email failed with status ${response.status} (${payload.code ?? "?"})`
      };
    }

    return {
      status: "SENT",
      providerMessageId: payload.messageId ?? null,
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

  // Prevent duplicate dispatch for the same crisis within 1 hour
  const recentDispatch = await prisma.dispatchAlertLog.findFirst({
    where: {
      crisisEventId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    },
    select: { id: true }
  });
  if (recentDispatch) {
    console.log(`[dispatch] Crisis ${crisisEventId} already dispatched recently, skipping`);
    return;
  }

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
    },
    take: 500
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

  // Batch-fetch alert counts for all in-range volunteers (avoids N+1)
  const alertCounts = await prisma.dispatchAlertLog.groupBy({
    by: ["userId"],
    where: {
      userId: { in: inRangeVolunteers.map((v) => v.id) },
      createdAt: { gte: lookback }
    },
    _count: { _all: true }
  });
  const countMap = new Map<string, number>();
  for (const ac of alertCounts) {
    countMap.set(ac.userId, ac._count._all);
  }

  for (const volunteer of inRangeVolunteers) {
    const sentRecently = countMap.get(volunteer.id) ?? 0;

    if (sentRecently >= MAX_ALERTS_PER_24_HOURS) {
      continue;
    }

    try {
      const subject = `[CORE DISPATCH ALERT] ${crisis.severityLevel} ${crisis.title}`;
      const body = formatDispatchEmailBody({
        title: crisis.title,
        severityLevel: crisis.severityLevel,
        locationText: crisis.locationText,
        sitRepText: crisis.sitRepText,
        crisisEventId: crisis.id
      });

      const dispatch = await sendDispatchEmail(volunteer.email, { subject, body });

      // §15.4: Record alert delivery metric when an alert is successfully dispatched
      if (dispatch.status === "SENT") {
        metrics.recordAlertDelivery();
      }

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
    } catch (err) {
      console.error(`[dispatch] Failed to send alert to volunteer ${volunteer.id}:`, err);
    }
  }
}

/**
 * §15.4: Record that a dispatched alert was acknowledged by the recipient.
 * Verifies the alert log exists and records the ack metric.
 */
export async function acknowledgeDispatchAlert(alertLogId: string): Promise<void> {
  const alert = await prisma.dispatchAlertLog.findUnique({
    where: { id: alertLogId }
  });

  if (!alert) {
    throw new Error("Dispatch alert log not found");
  }

  // §15.4: Record alert acknowledgement metric
  metrics.recordAlertAck();
}
