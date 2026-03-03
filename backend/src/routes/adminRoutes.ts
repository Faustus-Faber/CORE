import { Router } from "express";

import {
  listUsers,
  updateUserBanStatus,
  updateUserRole
} from "../controllers/adminController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("ADMIN"));
adminRoutes.get("/users", asyncHandler(listUsers));
adminRoutes.patch("/users/:userId/role", asyncHandler(updateUserRole));
adminRoutes.patch("/users/:userId/ban", asyncHandler(updateUserBanStatus));
