/**
 * FFWC (Flood Forecasting and Warning Centre) Adapter
 *
 * Per refinement plan §19 "Should have":
 *   "official FFWC adapter for a flood demo"
 *   §15.5: "official Bangladesh sources such as FFWC where an authorized API is available"
 *
 * FFWC provides flood forecasting data for Bangladesh rivers.
 * Their water level data is published at https://ffwc.gov.bd/
 *
 * IMPORTANT: This adapter does NOT scrape or republish official warnings.
 * It only fetches publicly available water level data and converts it to
 * CORE's internal format for situational awareness. Official warnings must
 * come from authorized channels with confirmed terms, freshness, attribution,
 * and failure behavior (per §15.5).
 *
 * For the demo, if the FFWC API is unavailable, the adapter returns a
 * degraded response with a clear "source unavailable" indicator.
 */

export type FfwcWaterLevelReading = {
  stationName: string;
  river: string;
  waterLevelM: number;
  dangerLevelM: number;
  warningLevelM: number;
  status: "NORMAL" | "WARNING" | "DANGER" | "FLOOD";
  measuredAt: string;
};

export type FfwcAdapterResult = {
  readings: FfwcWaterLevelReading[];
  source: "ffwc";
  fetchedAt: string;
  available: boolean;
  note?: string;
};

const FFWC_API_URL = process.env.FFWC_API_URL ?? "";
const FFWC_API_KEY = process.env.FFWC_API_KEY ?? "";
const FFWC_TIMEOUT_MS = 10_000;

/**
 * Fetch current water level readings from FFWC.
 *
 * If the API URL is not configured or the request fails, returns a
 * degraded response with `available: false` rather than throwing.
 */
export async function fetchFfwcWaterLevels(): Promise<FfwcAdapterResult> {
  if (!FFWC_API_URL) {
    return {
      readings: [],
      source: "ffwc",
      fetchedAt: new Date().toISOString(),
      available: false,
      note: "FFWC API URL not configured. Set FFWC_API_URL to enable.",
    };
  }

  try {
    const response = await fetch(FFWC_API_URL, {
      headers: FFWC_API_KEY ? { Authorization: `Bearer ${FFWC_API_KEY}` } : {},
      signal: AbortSignal.timeout(FFWC_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        readings: [],
        source: "ffwc",
        fetchedAt: new Date().toISOString(),
        available: false,
        note: `FFWC API returned status ${response.status}`,
      };
    }

    const data = (await response.json()) as unknown;

    // Parse FFWC response format — this is a placeholder parser.
    // The actual format depends on the FFWC API specification.
    // For the demo, we handle a simple array of station readings.
    const readings = parseFfwcResponse(data);

    return {
      readings,
      source: "ffwc",
      fetchedAt: new Date().toISOString(),
      available: true,
    };
  } catch (error) {
    return {
      readings: [],
      source: "ffwc",
      fetchedAt: new Date().toISOString(),
      available: false,
      note: error instanceof Error ? error.message : "FFWC API request failed",
    };
  }
}

function parseFfwcResponse(data: unknown): FfwcWaterLevelReading[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      stationName: String(item.stationName ?? item.station ?? "Unknown"),
      river: String(item.river ?? item.riverName ?? "Unknown"),
      waterLevelM: Number(item.waterLevel ?? item.level ?? 0),
      dangerLevelM: Number(item.dangerLevel ?? 0),
      warningLevelM: Number(item.warningLevel ?? 0),
      status: deriveStatus(
        Number(item.waterLevel ?? item.level ?? 0),
        Number(item.dangerLevel ?? 0),
        Number(item.warningLevel ?? 0)
      ),
      measuredAt: String(item.measuredAt ?? item.timestamp ?? new Date().toISOString()),
    }));
}

function deriveStatus(
  waterLevel: number,
  dangerLevel: number,
  warningLevel: number
): FfwcWaterLevelReading["status"] {
  // Check FLOOD first (waterLevel exceeds danger level by 1m+) so it isn't
  // shadowed by the DANGER branch below.
  if (dangerLevel > 0 && waterLevel >= dangerLevel + 1) return "FLOOD";
  if (dangerLevel > 0 && waterLevel >= dangerLevel) return "DANGER";
  if (warningLevel > 0 && waterLevel >= warningLevel) return "WARNING";
  return "NORMAL";
}
