import type { IncidentSeverity, IncidentType } from "@prisma/client";

export const severityRanking: Record<IncidentSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export const objectIdHexPattern = /^[a-fA-F0-9]{24}$/;

const incidentTypeMap: Record<string, IncidentType> = {
  FLOOD: "FLOOD",
  FIRE: "FIRE",
  EARTHQUAKE: "EARTHQUAKE",
  BUILDING_COLLAPSE: "BUILDING_COLLAPSE",
  BUILDINGCOLLAPSE: "BUILDING_COLLAPSE",
  ROAD_ACCIDENT: "ROAD_ACCIDENT",
  ROADACCIDENT: "ROAD_ACCIDENT",
  VIOLENCE: "VIOLENCE",
  MEDICAL_EMERGENCY: "MEDICAL_EMERGENCY",
  MEDICALEMERGENCY: "MEDICAL_EMERGENCY",
  OTHER: "OTHER"
};

const severityMap: Record<string, IncidentSeverity> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW"
};

function normalizeKey(value: string) {
  return value.replace(/[\s-]+/g, "_").replace(/[^A-Za-z_]/g, "").toUpperCase();
}

export function toIncidentType(value: string): IncidentType {
  return incidentTypeMap[normalizeKey(value)] ?? "OTHER";
}

export function toIncidentSeverity(value: string): IncidentSeverity {
  return severityMap[normalizeKey(value)] ?? "LOW";
}

export function clampCredibilityScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
