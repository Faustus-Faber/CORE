import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.js";

export async function listVolunteers(request: Request, response: Response) {
    const { search, skills, availability, minRating, lat, lng, radiusKm, sortBy } = request.query;

    const where: any = { role: "VOLUNTEER" };

    let volunteers = await prisma.user.findMany({
        where,
        select: {
            id: true,
            fullName: true,
            email: true,
            location: true,
            latitude: true,
            longitude: true,
            skills: true,
            avatarUrl: true,
            availability: true,
            isFlagged: true,
            reviewsReceived: {
                select: { rating: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    let results = volunteers.map(v => {
        let avgRating = 0;
        if (v.reviewsReceived.length > 0) {
            const sum = v.reviewsReceived.reduce((acc, r) => acc + r.rating, 0);
            avgRating = parseFloat((sum / v.reviewsReceived.length).toFixed(1));
        }
        
        let distance: number | undefined;
        if (lat && lng && v.latitude != null && v.longitude != null) {
            const lat1 = Number(lat);
            const lon1 = Number(lng);
            const lat2 = v.latitude;
            const lon2 = v.longitude;
            const R = 6371; // Radius of Earth in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = parseFloat((R * c).toFixed(1));
        }
        
        const { reviewsReceived, ...rest } = v;
        return {
            ...rest,
            avgRating,
            reviewCount: v.reviewsReceived.length,
            distance
        };
    });

    if (search && typeof search === "string") {
        const q = search.toLowerCase();
        results = results.filter(v => 
            v.fullName.toLowerCase().includes(q) ||
            v.skills.some(s => s.toLowerCase().includes(q))
        );
    }

    if (skills && typeof skills === "string") {
        const skillFilters = skills.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        if (skillFilters.length > 0) {
            results = results.filter(v => 
                skillFilters.every(sf => v.skills.some(s => s.toLowerCase() === sf))
            );
        }
    }

    if (availability && typeof availability === "string") {
        const availFilters = availability.split(",").map(a => a.trim().toLowerCase());
        if (availFilters.length > 0 && !availFilters.includes("all")) {
            results = results.filter(v => {
                const volAvail = v.availability ? v.availability.toLowerCase() : "offline";
                return availFilters.includes(volAvail);
            });
        }
    }

    if (minRating) {
        const min = Number(minRating);
        results = results.filter(v => v.avgRating >= min);
    }

    if (radiusKm && Number(radiusKm) > 0 && lat && lng) {
        const maxDist = Number(radiusKm);
        results = results.filter(v => v.distance !== undefined && v.distance <= maxDist);
    }

    if (sortBy === "highest_rated") {
        results.sort((a, b) => b.avgRating - a.avgRating);
    } else if (sortBy === "alphabetical") {
        results.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (sortBy === "nearest" && lat && lng) {
        results.sort((a, b) => {
            const da = a.distance ?? Infinity;
            const db = b.distance ?? Infinity;
            return da - db;
        });
    }

    return response.status(200).json({ volunteers: results });
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
