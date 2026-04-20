import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { TaskCategory } from "@prisma/client";

import {
  getActiveCrisesForDropdown,
  getLeaderboard,
  getMyTimesheet,
  getPendingTasks,
  logTask,
  verifyTask
} from "../services/timesheetService.js";

// ── Validation schemas ─────────────────────────────────────────────────────

const logTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  category: z.nativeEnum(TaskCategory),
  hoursSpent: z.coerce
    .number()
    .min(0.5)
    .max(24)
    .refine((v) => v % 0.5 === 0, "Must be in 0.5-hour increments"),
  dateOfTask: z.string().refine((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && d <= new Date();
  }, "Date must be in the past"),
  crisisEventId: z.string().optional().nullable()
});

const verifyTaskSchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED"]),
  rejectionReason: z.string().optional()
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const leaderboardSchema = z.object({
  period: z.enum(["all", "month", "week"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

// ── Handlers ───────────────────────────────────────────────────────────────

export async function logTaskHandler(req: Request, res: Response, _next: NextFunction) {
  const volunteerId = req.authUser!.userId;
  const body = logTaskSchema.parse(JSON.parse(typeof req.body === "string" ? req.body : JSON.stringify(req.body)));

  const evidenceUrls = (req.files as Express.Multer.File[] | undefined)?.map((f) => f.filename) ?? [];

  const task = await logTask(volunteerId, {
    title: body.title,
    description: body.description,
    category: body.category,
    hoursSpent: body.hoursSpent,
    dateOfTask: new Date(body.dateOfTask),
    crisisEventId: body.crisisEventId ?? null,
    evidenceUrls
  });

  return res.status(201).json({ message: "Task logged successfully", task });
}

export async function getMyTimesheetHandler(req: Request, res: Response, _next: NextFunction) {
  const volunteerId = req.authUser!.userId;
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await getMyTimesheet(volunteerId, page, limit);
  return res.status(200).json(result);
}

export async function getLeaderboardHandler(req: Request, res: Response, _next: NextFunction) {
  const { period, limit } = leaderboardSchema.parse(req.query);
  const entries = await getLeaderboard(period, limit);
  return res.status(200).json({ entries, period });
}

export async function getPendingTasksHandler(req: Request, res: Response, _next: NextFunction) {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await getPendingTasks(page, limit);
  return res.status(200).json(result);
}

export async function verifyTaskHandler(req: Request, res: Response, _next: NextFunction) {
  const adminId = req.authUser!.userId;
  const taskId = String(req.params.id);
  const { decision, rejectionReason } = verifyTaskSchema.parse(req.body);
  const result = await verifyTask(taskId, adminId, decision, rejectionReason);
  return res.status(200).json({ message: `Task ${decision.toLowerCase()}`, ...result });
}

export async function getCrisesForDropdownHandler(_req: Request, res: Response, _next: NextFunction) {
  const crises = await getActiveCrisesForDropdown();
  return res.status(200).json({ crises });
}
