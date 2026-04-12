import type { IncidentSeverity, IncidentType } from "../types";

export const INCIDENT_TYPE_OPTIONS: Array<{ value: IncidentType; label: string }> = [
  { value: "FLOOD", label: "Flood" },
  { value: "FIRE", label: "Fire" },
  { value: "EARTHQUAKE", label: "Earthquake" },
  { value: "BUILDING_COLLAPSE", label: "Building Collapse" },
  { value: "ROAD_ACCIDENT", label: "Road Accident" },
  { value: "VIOLENCE", label: "Violence" },
  { value: "MEDICAL_EMERGENCY", label: "Medical Emergency" },
  { value: "OTHER", label: "Other" }
];

export const SEVERITY_OPTIONS: Array<{ value: IncidentSeverity | "ALL"; label: string }> = [
  { value: "ALL", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" }
];

export const TYPE_ICON_PATHS: Record<IncidentType, string> = {
  FLOOD: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  FIRE: "M12 23c-3.6 0-8-2.4-8-7.7 0-3.5 2.3-6.3 4.1-8.2.8-.9 1.5-1.6 1.9-2.3.4.7 1.1 1.4 1.9 2.3C13.7 9 16 11.8 16 15.3 16 20.6 15.6 23 12 23zm0-17.4c-.3.4-.7.8-1.1 1.3C9.3 8.6 7.3 11 7.3 15.3 7.3 19 10.2 20.7 12 20.7s4.7-1.7 4.7-5.4c0-4.3-2-6.7-3.6-8.4-.4-.5-.8-.9-1.1-1.3z",
  EARTHQUAKE: "M2 18h2v2H2v-2zm4 0h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM4 12l2 3h12l2-3H4zm16-6H4l-2 4h20l-2-4z",
  BUILDING_COLLAPSE: "M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z",
  ROAD_ACCIDENT: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
  VIOLENCE: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  MEDICAL_EMERGENCY: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z",
  OTHER: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
};

export function getTypeIconPath(type: IncidentType): string {
  return TYPE_ICON_PATHS[type] ?? TYPE_ICON_PATHS.OTHER;
}

const SEVERITY_BADGE: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-100 text-red-800 ring-red-200",
  HIGH: "bg-orange-100 text-orange-800 ring-orange-200",
  MEDIUM: "bg-amber-100 text-amber-800 ring-amber-200",
  LOW: "bg-emerald-100 text-emerald-800 ring-emerald-200"
};

const SEVERITY_DOT: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500"
};

export function severityBadgeClass(severity: IncidentSeverity): string {
  return SEVERITY_BADGE[severity];
}

export function severityDotClass(severity: IncidentSeverity): string {
  return SEVERITY_DOT[severity];
}

export type CredibilityStyle = {
  stroke: string;
  track: string;
  text: string;
  label: string;
};

export function credibilityStyle(score: number): CredibilityStyle {
  if (score >= 70) {
    return { stroke: "stroke-emerald-500", track: "stroke-emerald-100", text: "text-emerald-700", label: "Reliable" };
  }
  if (score >= 40) {
    return { stroke: "stroke-amber-500", track: "stroke-amber-100", text: "text-amber-700", label: "Needs Verification" };
  }
  return { stroke: "stroke-red-500", track: "stroke-red-100", text: "text-red-700", label: "Low Confidence" };
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function timeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export function normalizeMediaUrl(filePath: string): string {
  if (!filePath) return "";
  if (/^https?:\/\//.test(filePath)) return filePath;
  if (filePath.startsWith("/")) return `${API_ORIGIN}${filePath}`;
  return `${API_ORIGIN}/uploads/reports/${filePath}`;
}

export function isImageFile(filePath: string): boolean {
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(filePath);
}

export function isVideoFile(filePath: string): boolean {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(filePath);
}
