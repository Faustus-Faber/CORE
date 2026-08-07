import { Router } from "express";

import {
  forgotPassword,
  handleResetPassword,
  login,
  logout,
  me,
  register
} from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

export const authRoutes = Router();

// P1: Rate limit auth endpoints
authRoutes.post("/register", authRateLimiter, asyncHandler(register));
authRoutes.post("/login", authRateLimiter, asyncHandler(login));
authRoutes.post("/logout", asyncHandler(logout));
authRoutes.post("/forgot-password", authRateLimiter, asyncHandler(forgotPassword));
authRoutes.post("/reset-password", authRateLimiter, asyncHandler(handleResetPassword));
authRoutes.get("/me", requireAuth, asyncHandler(me));
