const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Guard against NaN/Infinity inputs — return Infinity so callers can
  // treat invalid coordinates as "impossibly far away" rather than
  // propagating NaN through downstream comparisons.
  if (
    !Number.isFinite(lat1) || !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) || !Number.isFinite(lng2)
  ) {
    return Infinity;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
