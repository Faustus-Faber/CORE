import type { Role, User } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { SafeError } from "../utils/SafeError.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registrationSchema,
  resetPasswordSchema
} from "../utils/validation.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./emailService.js";

function sanitizeUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    location: user.location,
    latitude: user.latitude,
    longitude: user.longitude,
    role: user.role,
    avatarUrl: user.avatarUrl,
    skills: user.skills,
    availability: user.availability,
    certifications: user.certifications,
    dispatchOptIn: user.dispatchOptIn,
    sessionVersion: user.sessionVersion,
    trustTier: user.trustTier,
    totalPoints: user.totalPoints,
    createdAt: user.createdAt
  };
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(payload: unknown) {
  const parsed = registrationSchema.parse(payload);

  const duplicate = await prisma.user.findFirst({
    where: {
      OR: [{ email: parsed.email }, { phone: parsed.phone }]
    }
  });

  if (duplicate) {
    throw new SafeError("An account with that email or phone already exists");
  }

  const passwordHash = await hashPassword(parsed.password);

  const user = await prisma.user.create({
    data: {
      fullName: parsed.fullName,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone,
      passwordHash,
      location: parsed.location,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      // P0-06/FR-01: Consented location metadata
      locationAccuracy: parsed.locationAccuracy ?? null,
      locationSource: parsed.locationSource ?? null,
      locationCapturedAt: parsed.locationCapturedAt ? new Date(parsed.locationCapturedAt) : null,
      locationConsentVersion: parsed.locationConsentVersion ?? null,
      // P0-04: All self-registered users get USER role.
      // Admins can promote to VOLUNTEER after reviewing skills/availability.
      role: "USER",
      skills: parsed.skills ?? [],
      availability: parsed.availability,
      certifications: parsed.certifications
    }
  });

  // FR-01: If the user registered with skills/availability, create a responder
  // profile in the APPLICANT state so coordinators can review and approve them.
  const wantsResponder = (parsed.skills?.length ?? 0) > 0 || Boolean(parsed.availability?.trim());
  if (wantsResponder) {
    await prisma.responderProfile.create({
      data: {
        userId: user.id,
        approvalStatus: "APPLICANT",
        approvedSkills: parsed.skills ?? [],
        certifications: parsed.certifications ? [parsed.certifications] : [],
        availabilityStatus: parsed.availability ? "AVAILABLE" : null,
      }
    });
  }

  await sendWelcomeEmail(user.email, user.fullName);

  return sanitizeUser(user);
}

export async function loginUser(payload: unknown) {
  const parsed = loginSchema.parse(payload);
  const normalizedIdentifier = parsed.identifier.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedIdentifier }, { phone: parsed.identifier }]
    }
  });

  // Always perform a bcrypt comparison to prevent timing-based account
  // enumeration. When the user doesn't exist, compare against a dummy hash
  // so the response time is similar to a real login attempt.
  const DUMMY_HASH = "$2a$12$abcdefghijklmnopqrstuvNOPQRSTUVWXYZ0123456789O0";

  if (!user) {
    await comparePassword(parsed.password, DUMMY_HASH);
    throw new SafeError("Invalid credentials");
  }

  if (user.isBanned) {
    await comparePassword(parsed.password, DUMMY_HASH);
    throw new SafeError("Account is blocked. Contact support.");
  }

  const isPasswordValid = await comparePassword(parsed.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new SafeError("Invalid credentials");
  }

  return {
    user: sanitizeUser(user),
    rememberMe: Boolean(parsed.rememberMe)
  };
}

export async function requestPasswordReset(payload: unknown) {
  const parsed = forgotPasswordSchema.parse(payload);

  const user = await prisma.user.findUnique({
    where: { email: parsed.email.toLowerCase() }
  });

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: tokenHash,
      resetTokenExpiry: expiresAt
    }
  });

  const resetUrl = `${process.env.CORS_ORIGIN ?? "http://localhost:5173"}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function resetPassword(payload: unknown) {
  const parsed = resetPasswordSchema.parse(payload);
  const tokenHash = hashResetToken(parsed.token);

  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: tokenHash,
      resetTokenExpiry: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new SafeError("Invalid or expired reset token");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.password),
      resetTokenHash: null,
      resetTokenExpiry: null,
      sessionVersion: { increment: 1 }
    }
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new SafeError("User not found");
  }

  return sanitizeUser(user);
}

export async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      role: true,
      isBanned: true,
      createdAt: true
    }
  });

  return users;
}

export async function setUserRoleByAdmin(userId: string, role: Role) {
  if (role === "ADMIN") {
    throw new SafeError("Cannot promote via endpoint to admin");
  }

  // P0-04: Validate volunteer prerequisites before promotion
  if (role === "VOLUNTEER") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { skills: true, availability: true }
    });

    if (!user) {
      throw new SafeError("User not found");
    }

    if (!user.skills?.length || !user.availability?.trim()) {
      throw new SafeError("Cannot promote to volunteer: skills and availability are required");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role, sessionVersion: { increment: 1 } }
  });

  // P0-03: Invalidate the auth status cache so the role change takes effect immediately
  const { invalidateUserStatusCache } = await import("../middleware/auth.js");
  invalidateUserStatusCache(userId);

  return updated;
}

export async function setUserBanStatusByAdmin(userId: string, isBanned: boolean) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned, sessionVersion: { increment: 1 } }
  });

  // P0-03: Invalidate the auth status cache so the ban takes effect immediately
  const { invalidateUserStatusCache } = await import("../middleware/auth.js");
  invalidateUserStatusCache(userId);

  return updated;
}
