import type { NextFunction, Request, Response } from "express";

import {
  getCurrentUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword
} from "../services/authService.js";
import { buildAuthCookieOptions, signAuthToken } from "../utils/jwt.js";

export async function register(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const user = await registerUser(request.body);
  return response.status(201).json({
    message: "Registration successful. Please log in.",
    user
  });
}

export async function login(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { user, rememberMe } = await loginUser(request.body);
  const token = signAuthToken({ userId: user.id, role: user.role }, rememberMe);

  response.cookie("core_token", token, buildAuthCookieOptions(rememberMe));

  return response.status(200).json({
    message: "Login successful",
    user
  });
}

export async function me(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (!request.authUser) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const user = await getCurrentUser(request.authUser.userId);
  return response.status(200).json({ user });
}

export async function logout(
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  response.clearCookie("core_token", buildAuthCookieOptions(false));
  return response.status(200).json({ message: "Logged out successfully" });
}

export async function forgotPassword(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  await requestPasswordReset(request.body);
  return response.status(200).json({
    message:
      "If that email is registered, a password reset link has been sent."
  });
}

export async function handleResetPassword(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  await resetPassword(request.body);
  return response.status(200).json({ message: "Password reset successful" });
}
