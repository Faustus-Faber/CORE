import { describe, expect, it } from "vitest";

import { validateRegistrationInput } from "../utils/validation.js";

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

  it("requires volunteer metadata when role is VOLUNTEER", () => {
    const payload = {
      fullName: "Test Volunteer",
      email: "volunteer@example.com",
      phone: "+8801812345678",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      location: "Dhaka",
      role: "VOLUNTEER"
    };

    expect(() => validateRegistrationInput(payload)).toThrow(
      "Volunteer skills and availability are required"
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
