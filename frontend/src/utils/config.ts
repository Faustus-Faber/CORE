/**
 * Unified frontend configuration module.
 * P0-17: Single source of truth for API URL, media origin, and feature flags.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "") || "http://localhost:5000";

export const config = {
  apiBase: API_BASE,
  apiOrigin: API_ORIGIN,
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
  mediaUrl: (path: string): string => {
    if (!path) return "";
    if (/^https?:\/\//.test(path)) return path;
    if (path.startsWith("/")) return `${API_ORIGIN}${path}`;
    return `${API_ORIGIN}/uploads/reports/${path}`;
  }
} as const;

export type AppConfig = typeof config;
