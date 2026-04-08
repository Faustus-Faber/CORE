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

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(register));
authRoutes.post("/login", asyncHandler(login));
authRoutes.post("/logout", asyncHandler(logout));
authRoutes.post("/forgot-password", asyncHandler(forgotPassword));
authRoutes.post("/reset-password", asyncHandler(handleResetPassword));
authRoutes.get("/me", requireAuth, asyncHandler(me));
