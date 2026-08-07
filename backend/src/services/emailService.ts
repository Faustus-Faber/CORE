import { env } from "../config/env.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

/** Strip CR/LF to prevent email header/body injection via user-controlled fields. */
function sanitizeText(text: string): string {
  return text.replace(/[\r\n]/g, " ").trim();
}

/**
 * Sends a welcome email via Brevo (configured) — never logs tokens.
 */
export async function sendWelcomeEmail(email: string, fullName: string) {
  if (!isValidEmail(email)) {
    console.error("[EMAIL] Invalid email address, skipping welcome email");
    return;
  }

  const safeName = sanitizeText(fullName);

  if (!env.brevoApiKey) {
    console.log(`[EMAIL] Welcome email skipped (no Brevo key): ${email}.`);
    return;
  }

  try {
    await sendViaBrevo(email, `Welcome to CORE, ${safeName}`, [
      `Hi ${safeName},`,
      "",
      "Your CORE account has been created successfully.",
      "You can now report incidents, browse crisis updates, and contribute to community resilience.",
      "",
      "Stay safe,",
      "The CORE Team"
    ].join("\n"));
  } catch (error) {
    console.error("[EMAIL] Failed to send welcome email:", error);
  }
}

/**
 * Sends a password reset email via Brevo.
 * The reset token is NEVER logged to the console.
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!isValidEmail(email)) {
    console.error("[EMAIL] Invalid email address, skipping password reset email");
    return;
  }

  if (!env.brevoApiKey) {
    // Dev fallback: do NOT log the URL (contains the secret reset token)
    console.log(`[EMAIL] Password reset queued for ${email} (set BREVO_API_KEY to enable delivery).`);
    return;
  }

  try {
    await sendViaBrevo(email, "CORE — Password Reset", [
      "You requested a password reset for your CORE account.",
      "",
      "Click the link below to reset your password. This link expires in 15 minutes.",
      "",
      resetUrl,
      "",
      "If you did not request this reset, you can safely ignore this email.",
      "",
      "The CORE Team"
    ].join("\n"));
  } catch (error) {
    console.error("[EMAIL] Failed to send password reset email:", error);
  }
}

async function sendViaBrevo(to: string, subject: string, body: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: env.brevoFromName,
          email: env.brevoFromEmail
        },
        to: [{ email: to }],
        subject,
        textContent: body
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };
      throw new Error(
        payload.message ?? `Brevo failed with status ${response.status} (${payload.code ?? "unknown"})`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Email service timed out after 10 seconds");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
