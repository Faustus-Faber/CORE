import { prisma } from "../lib/prisma.js";
import { getAvailableQuantity } from "./stockLedgerService.js";
import { SafeError } from "../utils/SafeError.js";

/**
 * FR-06: Get candidate responders for a need.
 * Ranks by skill match, distance, availability, and reliability.
 */
export async function getCandidateResponders(crisisEventId: string, needId: string) {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
  });

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  const need = await prisma.need.findUnique({
    where: { id: needId },
  });

  if (!need) {
    throw new SafeError("Need not found");
  }

  // Find approved volunteers with relevant skills
  const volunteers = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      isBanned: false,
      isFlagged: false,
    },
    select: {
      id: true,
      fullName: true,
      skills: true,
      latitude: true,
      longitude: true,
      availability: true,
    },
    take: 50,
  });

  // Score each volunteer
  const scored = volunteers.map((volunteer) => {
    let score = 0;

    // Skill match (simple keyword matching)
    const needTypeLower = need.needType.toLowerCase();
    const hasMatchingSkill = volunteer.skills.some((skill) =>
      skill.toLowerCase().includes(needTypeLower) ||
      needTypeLower.includes(skill.toLowerCase())
    );
    if (hasMatchingSkill) score += 30;

    // Distance scoring
    let distanceKm: number | undefined;
    if (crisis.latitude != null && crisis.longitude != null &&
        volunteer.latitude != null && volunteer.longitude != null) {
      distanceKm = haversineDistance(
        crisis.latitude, crisis.longitude,
        volunteer.latitude, volunteer.longitude
      );
      if (distanceKm < 5) score += 25;
      else if (distanceKm < 15) score += 15;
      else if (distanceKm < 30) score += 10;
      else if (distanceKm < 50) score += 5;
    }

    // Availability
    if (volunteer.availability === "Available" || volunteer.availability === "AVAILABLE") {
      score += 15;
    }

    return {
      id: volunteer.id,
      fullName: volunteer.fullName,
      skills: volunteer.skills,
      distanceKm,
      availabilityStatus: volunteer.availability,
      assignmentReliability: score,
    };
  });

  scored.sort((a, b) => (b.assignmentReliability ?? 0) - (a.assignmentReliability ?? 0));

  return scored.slice(0, 10);
}

/**
 * FR-08: Get candidate resources for a need.
 * Ranks by category match, distance, and available quantity.
 */
export async function getCandidateResources(crisisEventId: string, needId: string) {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
  });

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  const need = await prisma.need.findUnique({
    where: { id: needId },
  });

  if (!need) {
    throw new SafeError("Need not found");
  }

  // Find resources near the crisis
  const resources = await prisma.resource.findMany({
    where: {
      status: { in: ["Available", "Low Stock"] },
    },
    take: 50,
  });

  // Score each resource
  const scored = await Promise.all(
    resources.map(async (resource) => {
      let score = 0;

      // Category match
      const needTypeLower = need.needType.toLowerCase();
      const categoryLower = resource.category.toLowerCase();
      if (categoryLower.includes(needTypeLower) || needTypeLower.includes(categoryLower)) {
        score += 30;
      }

      // Distance scoring
      let distanceKm: number | undefined;
      if (crisis.latitude != null && crisis.longitude != null &&
          resource.latitude != null && resource.longitude != null) {
        distanceKm = haversineDistance(
          crisis.latitude, crisis.longitude,
          resource.latitude, resource.longitude
        );
        if (distanceKm < 5) score += 25;
        else if (distanceKm < 15) score += 15;
        else if (distanceKm < 30) score += 10;
        else if (distanceKm < 50) score += 5;
      }

      // Available quantity
      const availableQuantity = await getAvailableQuantity(resource.id);
      if (availableQuantity >= need.quantity) score += 20;
      else if (availableQuantity > 0) score += 10;

      return {
        id: resource.id,
        name: resource.name,
        category: resource.category,
        quantity: resource.quantity,
        unit: resource.unit,
        distanceKm,
        availableQuantity,
      };
    })
  );

  scored.sort((a, b) => {
    // Sort by whether they have enough stock, then by distance
    const aHasStock = (a.availableQuantity ?? 0) > 0 ? 1 : 0;
    const bHasStock = (b.availableQuantity ?? 0) > 0 ? 1 : 0;
    if (aHasStock !== bHasStock) return bHasStock - aHasStock;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });

  return scored.slice(0, 10);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
