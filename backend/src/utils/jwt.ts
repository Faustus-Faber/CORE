import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export type AuthTokenPayload = {
  userId: string;
  role: Role;
  exp?: number;
  iat?: number;
};

export function signAuthToken(
  payload: { userId: string; role: Role },
  rememberMe = false
) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: rememberMe ? "7d" : "24h"
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

export function buildAuthCookieOptions(rememberMe = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  };
}
