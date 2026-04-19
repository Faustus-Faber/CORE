import { useEffect, useMemo, useState } from "react";
import { SitRepPanel } from "../components/SitRepPanel";
import { IncidentFeed } from "../components/IncidentFeed";
import { DashboardFilters } from "../components/DashboardFilters";
import { getDashboardFeed } from "../services/api";
import type { CrisisEventCard, DashboardFeedFilters, IncidentType, IncidentSeverity, DashboardTimeRange } from "../types";

function getUserLocation(): { lat: number; lng: number } | null {
  if (!navigator.geolocation) return null;
  try {
    const cached = sessionStorage.getItem("core_user_location");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 300000) {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch {
  }
  return null;
}

export function DashboardPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [events, setEvents] = useState<CrisisEventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<DashboardFeedFilters>({
    incidentType: "ALL",
    severity: "ALL",
    timeRange: 0,
    sortBy: "mostRecent",
    sortOrder: "desc"
  });

  useEffect(() => {
    const cached = getUserLocation();
    if (cached) {
      setLocation(cached);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          sessionStorage.setItem("core_user_location", JSON.stringify({ ...loc, timestamp: Date.now() }));
        },
        () => {
          setLocation(null);
        },
        { enableHighAccuracy: false, timeout: 15000 }
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchFeed = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getDashboardFeed({
          ...filters,
          lat: location?.lat,
          lng: location?.lng,
          radiusKm: 10
        });
        if (!cancelled) setEvents(response.feed);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard feed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchFeed();
    return () => { cancelled = true; };
  }, [filters, location]);

  const stats = useMemo(() => {
    const active = events.filter((e) => e.status !== "RESOLVED" && e.status !== "CLOSED").length;
    const totalReports = events.reduce((sum, e) => sum + e.reportCount, 0);
    const critical = events.filter((e) => e.severityLevel === "CRITICAL").length;
    return { active, totalReports, critical };
  }, [events]);

  return (
    <div className="space-y-5">
      <SitRepPanel lat={location?.lat} lng={location?.lng} radiusKm={10} />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Active Incidents</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Reports Merged</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{stats.totalReports}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Critical</p>
          <p className="mt-1 text-2xl font-bold text-orange-700">{stats.critical}</p>
        </div>
      </section>

      <DashboardFilters filters={filters} onChange={setFilters} />

      <IncidentFeed events={events} loading={loading} error={error} />
    </div>
  );
}