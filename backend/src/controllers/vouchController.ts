import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  createVouch,
  getVouchesGiven,
  getVouchesReceived,
} from "../services/trustTierService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const createVouchSchema = z.object({
  vouchedForId: z.string().min(1),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500, "Reason must be 500 characters or less"),
  crisisEventId: z.string().optional().nullable(),
});

export const vouchController = {
  create: asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const vouchedById = req.authUser!.userId;
    const body = createVouchSchema.parse(req.body);
    const vouch = await createVouch(vouchedById, body.vouchedForId, body.reason, body.crisisEventId ?? undefined);
    return res.status(201).json({ message: "Vouch created successfully", vouch });
  }),

  getReceived: asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.authUser!.userId;
    const vouches = await getVouchesReceived(userId);
    return res.status(200).json({ vouches });
  }),

  getGiven: asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.authUser!.userId;
    const vouches = await getVouchesGiven(userId);
    return res.status(200).json({ vouches });
  }),
};
