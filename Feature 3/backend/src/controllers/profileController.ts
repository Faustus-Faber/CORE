import type { NextFunction, Request, Response } from "express";

import { changePassword, updateProfile } from "../services/profileService.js";

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
