import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { redactCoordinates } from "../utils/geoRedact.js";
import { metrics } from "../utils/metrics.js";

/**
 * FR-14 / P0-16: Redacted DTO for public evidence views.
 * Strips internal user IDs, roles, exact timestamps, and precise GPS
 * for non-internal viewers.
 */
function toPublicEvidenceDTO(
  post: any,
  viewerRole: string | undefined
) {
  const isInternal = viewerRole === "ADMIN" || viewerRole === "VOLUNTEER";
  const coords = redactCoordinates(post.latitude, post.longitude, viewerRole);
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    location: post.location,
    latitude: coords.latitude,
    longitude: coords.longitude,
    mediaUrls: post.mediaUrls,
    mediaType: post.mediaType,
    isVerified: post.isVerified,
    crisisEventId: post.crisisEventId,
    // Only expose author name for internal roles; public sees "Verified Reporter" or "Reporter"
    authorName: isInternal ? post.user?.fullName : (post.isVerified ? "Verified Reporter" : "Reporter"),
    authorAvatar: isInternal ? post.user?.avatarUrl : undefined,
    // Round timestamp to date only for public; full timestamp for internal
    createdAt: isInternal ? post.createdAt : (post.createdAt ? new Date(post.createdAt).toISOString().split("T")[0] : null),
    flagCount: post._count?.flags ?? 0,
  };
}

function inferFileExtension(file: Express.Multer.File) {
  const nameExtension = path.extname(file.originalname).toLowerCase();
  if (nameExtension && nameExtension.length <= 10) {
    return nameExtension;
  }

  if (file.mimetype.startsWith("image/")) {
    return `.${file.mimetype.slice("image/".length)}`;
  }

  if (file.mimetype.startsWith("video/")) {
    return `.${file.mimetype.slice("video/".length)}`;
  }

  return "";
}

async function persistMediaFiles(files: Express.Multer.File[]) {
  if (files.length === 0) {
    return [];
  }

  const uploadDirectory = path.resolve(process.cwd(), "uploads", "evidence");
  await mkdir(uploadDirectory, { recursive: true });

  return Promise.all(
    files.map(async (file) => {
      const extension = inferFileExtension(file);
      const filename = `${Date.now()}-${randomUUID()}${extension}`;
      const targetPath = path.join(uploadDirectory, filename);
      await writeFile(targetPath, file.buffer);

      return `/uploads/evidence/${filename}`;
    })
  );
}

export async function createEvidencePost(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;
  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const { title, description, mediaType, location, latitude, longitude, crisisEventId, visibility } = request.body;

  if (!title || !description || !mediaType || !location) {
    return response.status(400).json({ message: "Missing required fields" });
  }

  // Validate string lengths to prevent DoS via huge payloads
  if (title.length > 200) {
    return response.status(400).json({ message: "Title must be at most 200 characters" });
  }
  if (description.length > 5000) {
    return response.status(400).json({ message: "Description must be at most 5000 characters" });
  }
  if (location.length > 500) {
    return response.status(400).json({ message: "Location must be at most 500 characters" });
  }

  const files = request.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return response.status(400).json({ message: "At least one media file is required" });
  }

  const mediaUrls = await persistMediaFiles(files);
  const isVerified = request.authUser?.role === "ADMIN";

  // Parse coordinates safely — parseFloat returns NaN for invalid strings
  const parsedLat = latitude ? parseFloat(latitude) : null;
  const parsedLng = longitude ? parseFloat(longitude) : null;

  const post = await prisma.evidencePost.create({
    data: {
      userId,
      crisisEventId: crisisEventId || null,
      title,
      description,
      location,
      latitude: parsedLat != null && Number.isFinite(parsedLat) ? parsedLat : null,
      longitude: parsedLng != null && Number.isFinite(parsedLng) ? parsedLng : null,
      mediaUrls,
      mediaType,
      isVerified,
      // FR-10: Visibility classification — defaults to REDACTED_PUBLIC if not specified
      visibility: visibility || "REDACTED_PUBLIC",
    },
    include: {
      user: {
        select: {
          fullName: true,
          avatarUrl: true,
          role: true,
        }
      }
    }
  });

  return response.status(201).json({
    message: "Evidence post created successfully",
    post
  });
}

export async function listEvidencePosts(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { filter, sort, crisisEventId } = request.query;

  const where: any = {};
  if (filter === "verified") {
    where.isVerified = true;
  }
  if (crisisEventId) {
    where.crisisEventId = String(crisisEventId);
  }
  // AC-10.04: Enforce MediaVisibility — non-admins can't see PRIVATE or INCIDENT_TEAM evidence
  const viewerRole = request.authUser?.role;
  if (viewerRole !== "ADMIN") {
    where.visibility = { in: ["REDACTED_PUBLIC", "ORGANIZATION", "SHARE_PACKAGE"] };
  }

  const orderBy: any = {};
  if (sort === "oldest") {
    orderBy.createdAt = "asc";
  } else {
    orderBy.createdAt = "desc";
  }

  const posts = await prisma.evidencePost.findMany({
    where,
    orderBy,
    take: 100,
    include: {
      user: {
        select: {
          fullName: true,
          avatarUrl: true,
          role: true,
        }
      },
      _count: {
        select: {
          flags: true
        }
      }
    }
  });

  // P0-16: Return redacted DTOs to prevent leaking internal user fields
  return response.status(200).json(posts.map((p) => toPublicEvidenceDTO(p, viewerRole)));
}

export async function verifyEvidencePost(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const { id } = request.params as { id: string };

  if (request.authUser?.role !== "ADMIN") {
    return response.status(403).json({ message: "Forbidden: Only admins can verify posts" });
  }

  try {
    const post = await prisma.evidencePost.update({
      where: { id },
      data: { isVerified: true },
      include: {
        user: {
          select: {
            fullName: true,
            avatarUrl: true,
            role: true,
          }
        }
      }
    });

    // Award community contribution points for verified evidence (+5 pts)
    // This helps unapproved volunteers earn points toward responder status
    if (post.user.role === "VOLUNTEER") {
      try {
        await prisma.user.update({
          where: { id: post.userId },
          data: { totalPoints: { increment: 5 } }
        });
        const { checkAndAwardBadges } = await import("../services/timesheetService.js");
        const { checkAndPromoteTrustTier } = await import("../services/trustTierService.js");
        await checkAndAwardBadges(post.userId);
        await checkAndPromoteTrustTier(post.userId);
      } catch (err) {
        console.error("[evidence-verify] Failed to award points:", err);
      }
    }

    return response.status(200).json({
      message: "Post verified successfully (+5 points awarded)",
      post
    });
  } catch (error) {
    return response.status(404).json({ message: "Post not found" });
  }
}

export async function flagEvidencePost(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const userId = request.authUser?.userId;
  if (!userId) {
    return response.status(401).json({ message: "Authentication required" });
  }

  const { id } = request.params as { id: string };
  const { reason } = request.body;

  if (!reason || typeof reason !== "string") {
    return response.status(400).json({ message: "Flagging reason is required" });
  }
  if (reason.length > 500) {
    return response.status(400).json({ message: "Reason must be 500 characters or less" });
  }

  try {
    await prisma.evidenceFlag.create({
      data: {
        postId: id,
        userId,
        reason,
      }
    });

    return response.status(201).json({
      message: "Post has been flagged for review"
    });
  } catch (error) {
    return response.status(404).json({ message: "Post not found" });
  }
}

export async function updateEvidencePost(
  request: Request,
  response: Response
) {
  const userId = request.authUser?.userId;
  const id = request.params.id as string;
  const { title, description } = request.body;

  // Validate string lengths to prevent DoS via huge payloads
  if (typeof title !== "string" || title.length === 0 || title.length > 200) {
    return response.status(400).json({ message: "Title must be 1-200 characters" });
  }
  if (typeof description !== "string" || description.length > 5000) {
    return response.status(400).json({ message: "Description must be at most 5000 characters" });
  }

  const post = await prisma.evidencePost.findUnique({ where: { id } });

  if (!post) {
    return response.status(404).json({ message: "Post not found" });
  }

  if (post.userId !== userId) {
    // §15.4: Record asset auth failure — unauthorized access attempt to media asset
    metrics.recordAssetAuthFailure();
    return response.status(403).json({ message: "Forbidden" });
  }

  // AC-10.3: Save the previous version to append-only history before updating
  await prisma.$transaction([
    prisma.evidencePostVersion.create({
      data: {
        evidencePostId: id,
        version: post.version,
        title: post.title,
        description: post.description,
        editedById: userId,
      }
    }),
    prisma.evidencePost.update({
      where: { id },
      data: {
        title,
        description,
        version: { increment: 1 }
      },
      include: {
        user: {
          select: {
            fullName: true,
            avatarUrl: true,
            role: true,
          }
        }
      }
    })
  ]);

  const updatedPost = await prisma.evidencePost.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          fullName: true,
          avatarUrl: true,
          role: true,
        }
      }
    }
  });

  return response.status(200).json(updatedPost);
}

export async function deleteEvidencePost(
  request: Request,
  response: Response
) {
  const userId = request.authUser?.userId;
  const id = request.params.id as string;

  const post = await prisma.evidencePost.findUnique({ where: { id } });

  if (!post) {
    return response.status(404).json({ message: "Post not found" });
  }

  if (post.userId !== userId) {
    // §15.4: Record asset auth failure — unauthorized access attempt to media asset
    metrics.recordAssetAuthFailure();
    return response.status(403).json({ message: "Forbidden" });
  }

  // Clean up associated media files from disk
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  for (const mediaUrl of post.mediaUrls) {
    try {
      const filePath = path.resolve(process.cwd(), mediaUrl.replace(/^\//, ""));
      // Defense-in-depth: ensure resolved path is within uploads directory
      if (!filePath.startsWith(uploadsRoot + path.sep)) {
        console.error(`Refusing to delete file outside uploads dir: ${mediaUrl}`);
        continue;
      }
      await unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete file ${mediaUrl}:`, err);
      // Continue with deletion even if file cleanup fails
    }
  }

  await prisma.evidencePost.delete({ where: { id } });

  return response.status(200).json({ message: "Post deleted successfully" });
}
