import { describe, it, expect } from "vitest";
import { buildEmergencyReportFormData } from "../services/reportPayload";
import type { EmergencyReportSubmissionInput } from "../types";

describe("buildEmergencyReportFormData", () => {
  it("includes all required text fields", () => {
    const payload: EmergencyReportSubmissionInput = {
      incidentTitle: "Test Flood",
      description: "Water rising on Main St",
      incidentType: "FLOOD",
      locationText: "Dhaka",
      mediaFiles: [],
    };
    const formData = buildEmergencyReportFormData(payload);

    expect(formData.get("incidentTitle")).toBe("Test Flood");
    expect(formData.get("description")).toBe("Water rising on Main St");
    expect(formData.get("incidentType")).toBe("FLOOD");
    expect(formData.get("locationText")).toBe("Dhaka");
  });

  it("includes latitude and longitude when provided", () => {
    const payload: EmergencyReportSubmissionInput = {
      incidentTitle: "Test",
      description: "desc",
      incidentType: "FIRE",
      locationText: "Here",
      latitude: 23.81,
      longitude: 90.41,
      mediaFiles: [],
    };
    const formData = buildEmergencyReportFormData(payload);

    expect(formData.get("latitude")).toBe("23.81");
    expect(formData.get("longitude")).toBe("90.41");
  });

  it("includes aiConsent in the form data", () => {
    const payload: EmergencyReportSubmissionInput = {
      incidentTitle: "Test",
      description: "desc",
      incidentType: "FLOOD",
      locationText: "Here",
      mediaFiles: [],
      aiConsent: true,
    };
    const formData = buildEmergencyReportFormData(payload);

    expect(formData.get("aiConsent")).toBe("true");
  });

  it("defaults aiConsent to false when not provided", () => {
    const payload: EmergencyReportSubmissionInput = {
      incidentTitle: "Test",
      description: "desc",
      incidentType: "FLOOD",
      locationText: "Here",
      mediaFiles: [],
    };
    const formData = buildEmergencyReportFormData(payload);

    expect(formData.get("aiConsent")).toBe("false");
  });

  it("trims whitespace from text fields", () => {
    const payload: EmergencyReportSubmissionInput = {
      incidentTitle: "  Spaced Title  ",
      description:  "  Spaced desc  ",
      incidentType: "FLOOD",
      locationText: "  Spaced location  ",
      mediaFiles: [],
    };
    const formData = buildEmergencyReportFormData(payload);

    expect(formData.get("incidentTitle")).toBe("Spaced Title");
    expect(formData.get("description")).toBe("Spaced desc");
    expect(formData.get("locationText")).toBe("Spaced location");
  });
});
