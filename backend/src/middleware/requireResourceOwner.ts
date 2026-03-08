import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma.js";

export function requireResourceOwner(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const userId = request.authUser?.userId;
  const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  if (!resourceId) {
    return response.status(400).json({ message: "Resource ID required" });
  }

  prisma.resource
    .findUnique({
      where: { id: resourceId },
      select: { userId: true }
    })
    .then((resource) => {
      if (!resource) {
        return response.status(404).json({ message: "Resource not found" });
      }

      if (resource.userId !== userId) {
        return response
          .status(403)
          .json({ message: "You can only modify your own resources" });
      }

      return next();
    })
    .catch((err) => {
      console.error("requireResourceOwner error:", err);
      return response.status(500).json({ message: "Server error" });
    });
}
