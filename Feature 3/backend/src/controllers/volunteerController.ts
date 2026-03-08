import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.js";

export async function listVolunteers(_request: Request, response: Response) {
    const volunteers = await prisma.user.findMany({
        where: {
            role: "VOLUNTEER"
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            location: true,
            skills: true,
            avatarUrl: true
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return response.status(200).json({ volunteers });
}

export async function getVolunteerProfile(request: Request, response: Response) {
    const volunteerId = String(request.params.volunteerId);

    const volunteer = await prisma.user.findUnique({
        where: { id: volunteerId },
        select: {
            id: true,
            fullName: true,
            email: true,
            location: true,
            role: true,
            skills: true,
            availability: true,
            certifications: true,
            avatarUrl: true,
            isFlagged: true,
            volunteerFlagReasons: true
        }
    });

    if (!volunteer) {
        return response.status(404).json({ message: "Volunteer not found" });
    }

    if (volunteer.role !== "VOLUNTEER") {
        return response.status(400).json({ message: "User is not a volunteer" });
    }

    return response.status(200).json({ volunteer });
}
