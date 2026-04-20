import type { NextFunction, Request, Response } from "express";

import { verifyAuthToken } from "../utils/jwt.js";

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const bearer = request.headers.authorization;
  const tokenFromHeader =
    bearer && bearer.startsWith("Bearer ") ? bearer.replace("Bearer ", "") : undefined;
  const token = request.cookies?.core_token ?? tokenFromHeader;

  if (!token) {
    return response.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyAuthToken(token);
    request.authUser = { userId: payload.userId, role: payload.role as any };
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (request.authUser?.role !== "ADMIN") {
    return response.status(403).json({ message: "Admin access required" });
  }
  return next();
}
