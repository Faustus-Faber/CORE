import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma.js";
import { verifyAuthToken } from "../utils/jwt.js";

// P0-03: Cache user status lookups briefly to avoid hitting the DB on every request.
// Stale entries are acceptable for up to 30 seconds — banned users will be caught
// on the next request after the cache expires.
const STATUS_CACHE_TTL_MS = 30_000;
const STATUS_CACHE_MAX_SIZE = 10_000; // Prevent unbounded memory growth

type CachedStatus = {
  isBanned: boolean;
  role: string;
  sessionVersion: number;
  organizationId: string | null;
  fetchedAt: number;
};

const statusCache = new Map<string, CachedStatus>();

async function getUserStatus(userId: string): Promise<CachedStatus | null> {
  const now = Date.now();
  const cached = statusCache.get(userId);
  if (cached && now - cached.fetchedAt < STATUS_CACHE_TTL_MS) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true, role: true, sessionVersion: true, organizationId: true }
  });

  if (!user) return null;

  const status: CachedStatus = {
    isBanned: user.isBanned,
    role: user.role,
    sessionVersion: user.sessionVersion,
    organizationId: user.organizationId,
    fetchedAt: now
  };

  // Evict oldest entries if the cache has grown too large (simple LRU-ish eviction)
  if (statusCache.size >= STATUS_CACHE_MAX_SIZE) {
    const oldestKey = statusCache.keys().next().value;
    if (oldestKey) statusCache.delete(oldestKey);
  }

  statusCache.set(userId, status);
  return status;
}

/** Invalidate the cached status for a user (call after ban/role change). */
export function invalidateUserStatusCache(userId: string): void {
  statusCache.delete(userId);
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const bearer = request.headers.authorization;
  const tokenFromHeader =
    bearer && bearer.startsWith("Bearer ") ? bearer.replace("Bearer ", "") : undefined;
  const token = request.cookies?.core_token ?? tokenFromHeader;

  if (!token) {
    return response.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyAuthToken(token);

    // P0-03: Enforce current account status and role on every request
    const status = await getUserStatus(payload.userId);
    if (!status) {
      return response.status(401).json({ message: "Account no longer exists" });
    }

    if (status.isBanned) {
      return response.status(403).json({ message: "Account is blocked. Contact support." });
    }

    // FR-01: Enforce session version — if the DB sessionVersion is newer than the
    // token's, the token is stale (role changed or sessions invalidated) and must
    // be rejected so the client re-authenticates.
    const tokenSessionVersion = payload.sessionVersion ?? 0;
    if (status.sessionVersion > tokenSessionVersion) {
      return response.status(401).json({ message: "Session expired. Please log in again." });
    }

    // Use the current role from the DB, not the stale JWT role
    request.authUser = { userId: payload.userId, role: status.role as never, organizationId: status.organizationId };
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}
