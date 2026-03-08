import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  createResource,
  getResourceById,
  getUserResources,
  deactivateResource,
  deleteResource,
  updateResource
} from "../services/resourceService.js";

describe("Resource Service", () => {
  const testUserId = "test-user-123";
  const testResourceData = {
    name: "Test Medical Kit",
    category: "Medical Supplies",
    quantity: 10,
    unit: "pieces",
    condition: "New",
    address: "123 Test Street, Dhaka",
    latitude: 23.8103,
    longitude: 90.4125,
    contactPreference: "Phone",
    userId: testUserId
  };

  beforeEach(async () => {
    // Clean up any existing test resources
    await prisma.resource.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.resource.deleteMany({});
  });

  describe("createResource", () => {
    it("creates a resource with Available status", async () => {
      const resource = await createResource(testResourceData);

      expect(resource.name).toBe(testResourceData.name);
      expect(resource.category).toBe(testResourceData.category);
      expect(resource.quantity).toBe(testResourceData.quantity);
      expect(resource.status).toBe("Available");
      expect(resource.userId).toBe(testUserId);
      expect(resource.latitude).toBe(testResourceData.latitude);
      expect(resource.longitude).toBe(testResourceData.longitude);
    });

    it("creates a resource with optional fields", async () => {
      const resourceWithData = {
        ...testResourceData,
        availabilityStart: new Date("2026-03-07T10:00:00Z"),
        availabilityEnd: new Date("2026-03-14T10:00:00Z"),
        notes: "Test notes",
        photos: ["photo1.jpg", "photo2.jpg"]
      };

      const resource = await createResource(resourceWithData);

      expect(resource.availabilityStart).toEqual(resourceWithData.availabilityStart);
      expect(resource.availabilityEnd).toEqual(resourceWithData.availabilityEnd);
      expect(resource.notes).toBe(resourceWithData.notes);
      expect(resource.photos).toEqual(resourceWithData.photos);
    });
  });

  describe("getResourceById", () => {
    it("returns a resource by id", async () => {
      const created = await createResource(testResourceData);
      const found = await getResourceById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(testResourceData.name);
    });

    it("returns null for non-existent resource", async () => {
      // Use valid MongoDB ObjectId format but non-existent id
      const found = await getResourceById("507f1f77bcf86cd799439011");
      expect(found).toBeNull();
    });
  });

  describe("getUserResources", () => {
    it("returns all resources for a user", async () => {
      await createResource(testResourceData);
      await createResource({
        ...testResourceData,
        name: "Second Resource",
        category: "Food & Water"
      });

      const resources = await getUserResources(testUserId);

      expect(resources.length).toBe(2);
      expect(resources.map(r => r.name)).toContain("Test Medical Kit");
      expect(resources.map(r => r.name)).toContain("Second Resource");
    });

    it("returns empty array for user with no resources", async () => {
      const resources = await getUserResources("user-with-no-resources");
      expect(resources).toEqual([]);
    });
  });

  describe("deactivateResource", () => {
    it("changes resource status to Unavailable", async () => {
      const created = await createResource(testResourceData);
      
      const deactivated = await deactivateResource(created.id);

      expect(deactivated).not.toBeNull();
      expect(deactivated?.status).toBe("Unavailable");
    });

    it("returns null for non-existent resource", async () => {
      // Use valid MongoDB ObjectId format but non-existent id
      const result = await deactivateResource("507f1f77bcf86cd799439011");
      expect(result).toBeNull();
    });
  });

  describe("deleteResource", () => {
    it("deletes a resource successfully", async () => {
      const created = await createResource(testResourceData);
      
      await deleteResource(created.id);
      
      const found = await getResourceById(created.id);
      expect(found).toBeNull();
    });

    it("does not throw for non-existent resource", async () => {
      // Use valid MongoDB ObjectId format but non-existent id
      await expect(deleteResource("507f1f77bcf86cd799439011")).resolves.not.toThrow();
    });
  });

  describe("updateResource", () => {
    it("updates resource fields", async () => {
      const created = await createResource(testResourceData);
      
      const updated = await updateResource(created.id, {
        name: "Updated Medical Kit",
        quantity: 20,
        notes: "Updated notes"
      });

      expect(updated?.name).toBe("Updated Medical Kit");
      expect(updated?.quantity).toBe(20);
      expect(updated?.notes).toBe("Updated notes");
      expect(updated?.category).toBe(testResourceData.category); // unchanged
    });

    it("updates resource status", async () => {
      const created = await createResource(testResourceData);
      
      const updated = await updateResource(created.id, {
        status: "Low Stock"
      });

      expect(updated?.status).toBe("Low Stock");
    });

    it("returns null for non-existent resource", async () => {
      // Use valid MongoDB ObjectId format but non-existent id
      const result = await updateResource("507f1f77bcf86cd799439011", {
        name: "Updated Name"
      });
      expect(result).toBeNull();
    });

    it("does not allow updating userId", async () => {
      const created = await createResource(testResourceData);
      
      const updated = await updateResource(created.id, {
        name: "Updated Name",
        // @ts-expect-error - userId should not be allowed
        userId: "different-user-id"
      });

      expect(updated?.userId).toBe(testUserId); // unchanged
    });
  });
});
