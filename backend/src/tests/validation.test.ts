import { describe, expect, it } from "vitest";

import {
  validateRegistrationInput,
  validateReservationInput
} from "../utils/validation.js";

describe("validateRegistrationInput", () => {
  it("accepts a valid user registration", () => {
    const payload = {
      fullName: "Test User",
      email: "test@example.com",
      phone: "+8801712345678",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      location: "Dhaka",
      role: "USER"
    };

    const parsed = validateRegistrationInput(payload);
    expect(parsed.role).toBe("USER");
  });

  it("allows volunteer registration with optional skills (P0-04: gated self-registration)", () => {
    const payload = {
      fullName: "Test Volunteer",
      email: "volunteer@example.com",
      phone: "+8801812345678",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      location: "Dhaka",
      role: "VOLUNTEER",
      skills: ["First Aid"],
      availability: "Available"
    };

    const parsed = validateRegistrationInput(payload);
    expect(parsed.role).toBe("VOLUNTEER");
    expect(parsed.skills).toEqual(["First Aid"]);
  });

  it("rejects admin self-registration", () => {
    const payload = {
      fullName: "Test Admin",
      email: "admin@example.com",
      phone: "+8801912345678",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      location: "Dhaka",
      role: "ADMIN"
    };

    expect(() => validateRegistrationInput(payload)).toThrow(
      "Admin role cannot be self-registered"
    );
  });

  it("rejects weak passwords", () => {
    const payload = {
      fullName: "Weak Password User",
      email: "weak@example.com",
      phone: "+8801912345678",
      password: "weak1!",
      confirmPassword: "weak1!",
      location: "Dhaka",
      role: "USER"
    };

    expect(() => validateRegistrationInput(payload)).toThrow(
      "Password must be at least 8 characters"
    );
  });
});

describe("validateReservationInput", () => {
  it("accepts a valid reservation payload", () => {
    const payload = {
      resourceId: "507f1f77bcf86cd799439011",
      quantity: 2,
      justification: "Needed for a displaced family of four",
      pickupTime: "2026-04-23T12:00:00.000Z"
    };

    const parsed = validateReservationInput(payload);
    expect(parsed.quantity).toBe(2);
  });

  it("rejects very short justifications", () => {
    expect(() =>
      validateReservationInput({
        resourceId: "507f1f77bcf86cd799439011",
        quantity: 1,
        justification: "Too short"
      })
    ).toThrow("Justification must be at least 10 characters");
  });
});
