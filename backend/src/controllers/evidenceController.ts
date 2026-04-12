import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

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

  const { title, description, mediaType, location, latitude, longitude } = request.body;
  
  if (!title || !description || !mediaType || !location) {
    return response.status(400).json({ message: "Missing required fields" });
  }

  const files = request.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return response.status(400).json({ message: "At least one media file is required" });
  }

  const mediaUrls = await persistMediaFiles(files);
  const isVerified = request.authUser?.role === "ADMIN";

  const post = await prisma.evidencePost.create({
    data: {
      userId,
      title,
      description,
      location,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      mediaUrls,
      mediaType,
      isVerified,
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
  const { filter, sort } = request.query;

  const where: any = {};
  if (filter === "verified") {
    where.isVerified = true;
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
    include: {
      user: {
        select: {
          fullName: true,
          avatarUrl: true,
          role: true,
        }
      },
      comments: {
        include: {
          user: {
            select: {
              fullName: true,
              avatarUrl: true,
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      likes: {
        select: {
          userId: true
        }
      },
      _count: {
        select: {
          likes: true,
          comments: true
        }
      }
    }
  });

  return response.status(200).json(posts);
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

    return response.status(200).json({
      message: "Post verified successfully",
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

  if (!reason) {
    return response.status(400).json({ message: "Flagging reason is required" });
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

  const post = await prisma.evidencePost.findUnique({ where: { id } });

  if (!post) {
    return response.status(404).json({ message: "Post not found" });
  }

  if (post.userId !== userId) {
    return response.status(403).json({ message: "Forbidden" });
  }

  const updatedPost = await prisma.evidencePost.update({
    where: { id },
    data: { title, description },
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
    return response.status(403).json({ message: "Forbidden" });
  }

  await prisma.evidencePost.delete({ where: { id } });

  return response.status(200).json({ message: "Post deleted successfully" });
}

export async function toggleLikePost(
  request: Request,
  response: Response
) {
  const userId = request.authUser?.userId;
  const postId = request.params.id as string;

  if (!userId) return response.status(401).json({ message: "Auth required" });

  const existingLike = await prisma.like.findUnique({
    where: {
      postId_userId: { postId, userId }
    }
  });

  if (existingLike) {
    await prisma.like.delete({
      where: {
        postId_userId: { postId, userId }
      }
    });
    return response.status(200).json({ liked: false });
  } else {
    await prisma.like.create({
      data: { postId, userId }
    });
    return response.status(200).json({ liked: true });
  }
}

export async function addComment(
  request: Request,
  response: Response
) {
  const userId = request.authUser?.userId;
  const postId = request.params.id as string;
  const { content } = request.body;

  if (!userId) return response.status(401).json({ message: "Auth required" });
  if (!content) return response.status(400).json({ message: "Content required" });

  const comment = await prisma.comment.create({
    data: {
      postId,
      userId,
      content
    },
    include: {
      user: {
        select: {
          fullName: true,
          avatarUrl: true
        }
      }
    }
  });

  return response.status(201).json(comment);
}
