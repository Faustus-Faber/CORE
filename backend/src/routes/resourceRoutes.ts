import { Router } from "express";
import multer from "multer";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireResourceOwner } from "../middleware/requireResourceOwner.js";
import {
  approveReservation,
  createReservation,
  createResource,
  deactivateResource,
  declineReservation,
  deleteResource,
  getResourceById,
  getUserResources,
  listReservationsForOwner,
  listResourceHistory,
  updateResource
} from "../services/resourceService.js";
import {
  validateCreateResourceInput,
  validateReservationInput,
  validateUpdateResourceInput
} from "../utils/validation.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, "uploads/"),
  filename: (_request, file, callback) => callback(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post("/add", requireAuth, upload.array("photos", 3), async (request, response) => {
  try {
    const userId = request.authUser?.userId;
    if (!userId) {
      return response.status(401).json({ message: "Authentication required" });
    }

    const parsedPayload = validateCreateResourceInput({
      name: String(request.body.name ?? ""),
      category: String(request.body.category ?? ""),
      quantity: Number(request.body.quantity),
      unit: String(request.body.unit ?? ""),
      condition: String(request.body.condition ?? ""),
      address: String(request.body.address ?? ""),
      latitude: Number(request.body.latitude),
      longitude: Number(request.body.longitude),
      availabilityStart: String(request.body.availabilityStart ?? ""),
      availabilityEnd: String(request.body.availabilityEnd ?? ""),
      contactPreference: String(request.body.contactPreference ?? ""),
      notes: String(request.body.notes ?? "")
    });

    const resource = await createResource({
      ...parsedPayload,
      availabilityStart: parsedPayload.availabilityStart
        ? new Date(parsedPayload.availabilityStart)
        : undefined,
      availabilityEnd: parsedPayload.availabilityEnd
        ? new Date(parsedPayload.availabilityEnd)
        : undefined,
      notes: parsedPayload.notes || undefined,
      photos: (request.files as Express.Multer.File[] | undefined)?.map((file) => file.path),
      userId
    });

    return response.status(201).json(resource);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return response.status(400).json({
        message: "Validation failed",
        issues: error.issues
      });
    }

    console.error("Add resource error:", error);
    return response.status(500).json({ message: error.message ?? "Server error" });
  }
});

router.get("/all", async (_request, response) => {
  try {
    const resources = await prisma.resource.findMany({
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        category: true,
        quantity: true,
        unit: true,
        address: true,
        contactPreference: true,
        status: true,
        notes: true
      }
    });

    return response.json(resources);
  } catch (error: any) {
    return response.status(500).json({ message: error.message });
  }
});

router.get("/my", requireAuth, async (request, response) => {
  try {
    const userId = request.authUser?.userId;
    if (!userId) {
      return response.status(401).json({ message: "Authentication required" });
    }

    const resources = await getUserResources(userId);
    return response.json(resources);
  } catch (error: any) {
    console.error("Get user resources error:", error);
    return response.status(500).json({ message: error.message ?? "Server error" });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const resource = await getResourceById(resourceId);

    if (!resource) {
      return response.status(404).json({ message: "Resource not found" });
    }

    return response.json(resource);
  } catch (error: any) {
    console.error("Get resource error:", error);
    return response.status(500).json({ message: error.message ?? "Server error" });
  }
});

router.patch("/update/:id", requireAuth, requireResourceOwner, async (request, response) => {
  try {
    const validatedData = validateUpdateResourceInput(request.body);
    const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const updated = await updateResource(resourceId, validatedData);

    if (!updated) {
      return response.status(404).json({ message: "Resource not found" });
    }

    return response.json({
      message: "Resource updated successfully",
      resource: updated
    });
  } catch (error: any) {
    console.error("Update resource error:", error);
    if (error.name === "ZodError") {
      return response.status(400).json({
        message: "Validation failed",
        issues: error.issues
      });
    }

    return response.status(400).json({ message: error.message ?? "Server error" });
  }
});

router.patch("/deactivate/:id", requireAuth, requireResourceOwner, async (request, response) => {
  try {
    const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const deactivated = await deactivateResource(resourceId);

    if (!deactivated) {
      return response.status(404).json({ message: "Resource not found" });
    }

    return response.json({
      message: "Resource deactivated",
      resource: deactivated
    });
  } catch (error: any) {
    console.error("Deactivate resource error:", error);
    return response.status(500).json({ message: error.message ?? "Server error" });
  }
});

router.delete("/delete/:id", requireAuth, requireResourceOwner, async (request, response) => {
  try {
    const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const deleted = await deleteResource(resourceId);

    if (!deleted) {
      return response.status(404).json({ message: "Resource not found" });
    }

    return response.json({ message: "Resource deleted successfully" });
  } catch (error: any) {
    console.error("Delete resource error:", error);
    return response.status(500).json({ message: error.message ?? "Server error" });
  }
});

router.post("/reserve", requireAuth, async (request, response) => {
  try {
    const userId = request.authUser?.userId;
    if (!userId) {
      return response.status(401).json({ message: "Authentication required" });
    }

    const payload = validateReservationInput({
      resourceId: String(request.body.resourceId ?? ""),
      quantity: Number(request.body.quantity),
      justification: String(request.body.justification ?? ""),
      pickupTime: request.body.pickupTime ? String(request.body.pickupTime) : null
    });

    const reservation = await createReservation(
      userId,
      payload.resourceId,
      payload.quantity,
      payload.justification,
      payload.pickupTime ? new Date(payload.pickupTime) : undefined
    );

    return response.status(201).json(reservation);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return response.status(400).json({
        message: "Validation failed",
        issues: error.issues
      });
    }

    return response.status(400).json({ message: error.message });
  }
});

router.get("/:id/reservations", requireAuth, requireResourceOwner, async (request, response) => {
  try {
    const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

    if (!resourceId) {
      return response.status(400).json({ message: "Resource ID required" });
    }

    const reservations = await listReservationsForOwner(resourceId);
    return response.json(reservations);
  } catch (error: any) {
    return response.status(500).json({ message: error.message });
  }
});

router.patch("/reservation/:id/approve", requireAuth, async (request, response) => {
  try {
    const actorId = request.authUser?.userId;
    const actorRole = request.authUser?.role;
    if (!actorId || !actorRole) {
      return response.status(401).json({ message: "Authentication required" });
    }

    const reservationId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const result = await approveReservation(actorId, actorRole, reservationId);

    return response.json({ message: "Reservation approved", reservation: result });
  } catch (error: any) {
    return response.status(400).json({ message: error.message });
  }
});

router.patch("/reservation/:id/decline", requireAuth, async (request, response) => {
  try {
    const actorId = request.authUser?.userId;
    const actorRole = request.authUser?.role;
    if (!actorId || !actorRole) {
      return response.status(401).json({ message: "Authentication required" });
    }

    const reservationId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const decisionReason =
      typeof request.body.reason === "string" ? request.body.reason.trim() : undefined;
    const result = await declineReservation(actorId, actorRole, reservationId, decisionReason);

    return response.json({ message: "Reservation declined", reservation: result });
  } catch (error: any) {
    return response.status(400).json({ message: error.message });
  }
});

router.get("/:id/history", requireAuth, requireResourceOwner, async (request, response) => {
  try {
    const resourceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const history = await listResourceHistory(resourceId);

    return response.json(history);
  } catch (error: any) {
    return response.status(500).json({ message: error.message });
  }
});

export { router as resourceRoutes };
