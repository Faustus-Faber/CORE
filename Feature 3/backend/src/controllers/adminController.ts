import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  listUsersForAdmin,
  setUserBanStatusByAdmin,
  setUserRoleByAdmin
} from "../services/authService.js";

const roleSchema = z.object({
  role: z.enum(["USER", "VOLUNTEER"])
});

const banSchema = z.object({
  isBanned: z.boolean()
});

export async function listUsers(
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  const users = await listUsersForAdmin();
  return response.status(200).json({ users });
}

export async function updateUserRole(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { role } = roleSchema.parse(request.body);
  const userId = String(request.params.userId);
  const updated = await setUserRoleByAdmin(userId, role);
  return response.status(200).json({
    message: "Role updated",
    user: {
      id: updated.id,
      role: updated.role
    }
  });
}

export async function updateUserBanStatus(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { isBanned } = banSchema.parse(request.body);
  const userId = String(request.params.userId);
  const updated = await setUserBanStatusByAdmin(userId, isBanned);
  return response.status(200).json({
    message: isBanned ? "User banned" : "User unbanned",
    user: {
      id: updated.id,
      isBanned: updated.isBanned
    }
  });
}
