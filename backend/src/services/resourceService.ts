import { prisma } from "../lib/prisma.js";

export interface CreateResourceData {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  condition: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPreference: string;
  userId: string;
  availabilityStart?: Date;
  availabilityEnd?: Date;
  notes?: string;
  photos?: string[];
}

export interface UpdateResourceData {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  condition?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  contactPreference?: string;
  availabilityStart?: Date | string;
  availabilityEnd?: Date | string;
  notes?: string;
  photos?: string[];
  status?: string;
}

export async function createResource(data: CreateResourceData) {
  return prisma.resource.create({
    data: {
      ...data,
      status: "Available"
    }
  });
}

export async function getResourceById(id: string) {
  try {
    return prisma.resource.findUnique({
      where: { id }
    });
  } catch {
    return null;
  }
}

export async function getUserResources(userId: string) {
  return prisma.resource.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

export async function deactivateResource(id: string) {
  return prisma.resource.update({
    where: { id },
    data: { status: "Unavailable" }
  }).catch(() => null);
}

export async function deleteResource(id: string) {
  return prisma.resource.delete({
    where: { id }
  }).catch(() => null);
}

export async function updateResource(id: string, data: UpdateResourceData) {
  // Prevent userId from being updated
  const { userId, ...updateData } = data as UpdateResourceData & { userId?: string };
  
  // Convert string dates to Date objects if needed
  const prismaData: Record<string, unknown> = { ...updateData };
  if (updateData.availabilityStart && typeof updateData.availabilityStart === "string") {
    prismaData.availabilityStart = updateData.availabilityStart ? new Date(updateData.availabilityStart) : null;
  }
  if (updateData.availabilityEnd && typeof updateData.availabilityEnd === "string") {
    prismaData.availabilityEnd = updateData.availabilityEnd ? new Date(updateData.availabilityEnd) : null;
  }
  
  return prisma.resource.update({
    where: { id },
    data: prismaData
  }).catch(() => null);
}
