import type { Role, User } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { comparePassword, hashPassword } from "../utils/password.js";
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
    role: user.role,
    avatarUrl: user.avatarUrl,
    skills: user.skills,
    availability: user.availability,
    certifications: user.certifications,
    dispatchOptIn: user.dispatchOptIn,
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
    throw new Error("An account with that email or phone already exists");
  }

  const passwordHash = await hashPassword(parsed.password);

  const user = await prisma.user.create({
    data: {
      fullName: parsed.fullName,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone,
      passwordHash,
      location: parsed.location,
      role: parsed.role,
      skills: parsed.skills ?? [],
      availability: parsed.availability,
      certifications: parsed.certifications
    }
  });

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

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (user.isBanned) {
    throw new Error("Account is blocked. Contact support.");
  }

  const isPasswordValid = await comparePassword(parsed.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
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
    throw new Error("Invalid or expired reset token");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.password),
      resetTokenHash: null,
      resetTokenExpiry: null
    }
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error("User not found");
  }

  return sanitizeUser(user);
}

export async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
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
    throw new Error("Cannot promote via endpoint to admin");
  }

  return prisma.user.update({
    where: { id: userId },
    data: { role }
  });
}

export async function setUserBanStatusByAdmin(userId: string, isBanned: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { isBanned }
  });
}
