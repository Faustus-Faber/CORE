/**
 * FR-14: Geographic privacy utilities.
 *
 * Internal roles (ADMIN, VOLUNTEER) see exact coordinates.
 * Public/community (USER) roles see coordinates rounded to ~100m precision
 * to preserve situational awareness without exposing exact GPS locations.
 */

import type { Role } from "@prisma/client";

/** Round to 3 decimal places (~100m precision at most latitudes). */
const PUBLIC_COORD_DECIMALS = 3;

/** Roles allowed to see exact GPS coordinates. */
const INTERNAL_ROLES: Role[] = ["ADMIN", "VOLUNTEER"];

export function isInternalRole(role: string | undefined): boolean {
  return !!role && (INTERNAL_ROLES as string[]).includes(role);
}

/**
 * Redact a single coordinate value for non-internal viewers.
 * Returns null if the input is null.
 */
export function redactCoordinate(
  value: number | null | undefined,
  role: string | undefined
): number | null {
  if (value == null) return null;
  if (isInternalRole(role)) return value;
  const factor = 10 ** PUBLIC_COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Redact a lat/lng pair for non-internal viewers.
 */
export function redactCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  role: string | undefined
): { latitude: number | null; longitude: number | null } {
  return {
    latitude: redactCoordinate(latitude, role),
    longitude: redactCoordinate(longitude, role)
  };
}
