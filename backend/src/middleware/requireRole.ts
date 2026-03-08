import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export function requireRole(...allowedRoles: Role[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.authUser) {
      return response.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(request.authUser.role)) {
      return response.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}
