import type { NextFunction, Request, Response } from "express";

import { changePassword, updateProfile } from "../services/profileService.js";
import { prisma } from "../lib/prisma.js";

export async function updateCurrentProfile(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;

  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const profile = await updateProfile(userId, request.body);
  return response.status(200).json({
    message: "Profile updated",
    profile
  });
}

export async function updateCurrentPassword(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;

  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  await changePassword(userId, request.body);
  return response.status(200).json({ message: "Password changed successfully" });
}

export async function toggleDispatchOptIn(request: Request, response: Response) {
  const userId = request.authUser?.userId;
  if (!userId) return response.status(401).json({ message: "Auth required" });

  const { dispatchOptIn } = request.body;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { dispatchOptIn: Boolean(dispatchOptIn) }
  });

  return response.json({ dispatchOptIn: user.dispatchOptIn });
}

export async function getMyDispatchLogs(request: Request, response: Response) {
  const userId = request.authUser?.userId;
  if (!userId) return response.status(401).json({ message: "Auth required" });

  const logs = await prisma.dispatchAlertLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { crisisEvent: { select: { title: true, severityLevel: true } } }
  });

  return response.json({ logs });
}
