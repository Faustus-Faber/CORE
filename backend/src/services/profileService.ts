import { prisma } from "../lib/prisma.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { changePasswordSchema, profileUpdateSchema } from "../utils/validation.js";
import { SafeError } from "../utils/SafeError.js";

export async function updateProfile(userId: string, payload: unknown) {
  const parsed = profileUpdateSchema.parse(payload);

  if (parsed.phone) {
    const duplicatePhoneUser = await prisma.user.findFirst({
      where: {
        phone: parsed.phone,
        id: { not: userId }
      }
    });

    if (duplicatePhoneUser) {
      throw new SafeError("Phone already in use by another account");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: parsed,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      role: true,
      avatarUrl: true,
      skills: true,
      availability: true,
      certifications: true,
      dispatchOptIn: true,
      updatedAt: true
    }
  });

  return updated;
}

export async function changePassword(userId: string, payload: unknown) {
  const parsed = changePasswordSchema.parse(payload);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    throw new SafeError("User not found");
  }

  const isCurrentPasswordValid = await comparePassword(
    parsed.currentPassword,
    user.passwordHash
  );

  if (!isCurrentPasswordValid) {
    throw new SafeError("Current password is incorrect");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed.newPassword)
    }
  });
}
