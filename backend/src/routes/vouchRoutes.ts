import { Router } from "express";

import { vouchController } from "../controllers/vouchController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const vouchRoutes = Router();

vouchRoutes.use(requireAuth);

// Any authenticated user can view vouches they've received
vouchRoutes.get("/received", vouchController.getReceived);

// Volunteers can view vouches they've given
vouchRoutes.get("/given", requireRole("VOLUNTEER", "ADMIN"), vouchController.getGiven);

// Only volunteers can create vouches (trust tier check happens in service)
vouchRoutes.post("/", requireRole("VOLUNTEER", "ADMIN"), vouchController.create);
