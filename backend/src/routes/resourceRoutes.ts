import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import { requireResourceOwner } from "../middleware/requireResourceOwner.js";
import {
  createResource,
  getResourceById,
  getUserResources,
  deactivateResource,
  deleteResource,
  updateResource
} from "../services/resourceService.js";
import { validateUpdateResourceInput } from "../utils/validation.js";
import {
  createReservation,
  approveReservation,
  declineReservation
} from "../services/resourceService.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/add", requireAuth, upload.array("photos", 3), async (req, res) => {
  try {
    const {
      name,
      category,
      quantity,
      unit,
      condition,
      address,
      latitude,
      longitude,
      availabilityStart,
      availabilityEnd,
      contactPreference,
      notes
    } = req.body;

    const userId = req.authUser?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (
      !name ||
      !category ||
      !quantity ||
      !unit ||
      !condition ||
      !address ||
      !latitude ||
      !longitude ||
      !contactPreference
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const photos = req.files
      ? (req.files as Express.Multer.File[]).map((f) => f.path)
      : [];

    const resource = await createResource({
      name,
      category,
      quantity: Number(quantity),
      unit,
      condition,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      availabilityStart: availabilityStart ? new Date(availabilityStart) : undefined,
      availabilityEnd: availabilityEnd ? new Date(availabilityEnd) : undefined,
      contactPreference,
      photos: photos.length > 0 ? photos : undefined,
      notes: notes || undefined,
      userId
    });

    res.status(201).json(resource);
  } catch (err: any) {
    console.error("Add resource error:", err);
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

router.get("/all", async (req, res) => {
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
    res.json(resources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resources = await getUserResources(userId);
    res.json(resources);
  } catch (err: any) {
    console.error("Get user resources error:", err);
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const resourceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const resource = await getResourceById(resourceId);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.json(resource);
  } catch (err: any) {
    console.error("Get resource error:", err);
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

router.patch("/update/:id", requireAuth, requireResourceOwner, async (req, res) => {
  try {
    const validatedData = validateUpdateResourceInput(req.body);
    const resourceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const updated = await updateResource(resourceId, validatedData);

    if (!updated) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json({
      message: "Resource updated successfully",
      resource: updated
    });
  } catch (err: any) {
    console.error("Update resource error:", err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

router.patch("/deactivate/:id", requireAuth, requireResourceOwner, async (req, res) => {
  try {
    const resourceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deactivated = await deactivateResource(resourceId);

    if (!deactivated) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json({
      message: "Resource deactivated",
      resource: deactivated
    });
  } catch (err: any) {
    console.error("Deactivate resource error:", err);
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

router.delete("/delete/:id", requireAuth, requireResourceOwner, async (req, res) => {
  try {
    const resourceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteResource(resourceId);

    if (!deleted) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json({ message: "Resource deleted successfully" });
  } catch (err: any) {
    console.error("Delete resource error:", err);
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

router.post("/reserve", requireAuth, async (req, res) => {
  try {
    const { resourceId, quantity, justification, pickupTime } = req.body;

    const userId = req.authUser?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const reservation = await createReservation(
      userId,
      resourceId,
      Number(quantity),
      justification,
      pickupTime ? new Date(pickupTime) : undefined
    );

    res.status(201).json(reservation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:id/reservations", requireAuth, async (req, res) => {
  try {
    const resourceId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!resourceId) {
      return res.status(400).json({ error: "Resource ID required" });
    }

    const reservations = await prisma.reservation.findMany({
      where: { resourceId },
      orderBy: { createdAt: "desc" }
    });

    res.json(reservations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/reservation/:id/approve", requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

    const result = await approveReservation(id);

    res.json({ message: "Reservation approved", reservation: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/reservation/:id/decline", requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

    const result = await declineReservation(id);

    res.json({ message: "Reservation declined", reservation: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:id/history", requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const history = await prisma.resourceHistory.findMany({
      where: { resourceId: id },
      orderBy: { createdAt: "desc" }
    });

    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as resourceRoutes };
