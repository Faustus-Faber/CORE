import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { getSitRep, openCriticalIncidentStream } from "../services/api";
import { useLoadScript, GoogleMap, Marker } from "@react-google-maps/api";
import type { SitRepBlueprint, ThreatLevel } from "../types";

const SITREP_REFRESH_INTERVAL_MS = 600000;

type SitRepPanelProps = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

const threatConfig: Record<ThreatLevel, { bg: string; glow: string; label: string; barFrom: string; barTo: string; pulse: string }> = {
  GREEN: { bg: "from-emerald-500 to-emerald-600", glow: "shadow-emerald-500/40", label: "ALL CLEAR", barFrom: "from-emerald-500", barTo: "to-emerald-400", pulse: "bg-emerald-500" },
  AMBER: { bg: "from-amber-500 to-amber-600", glow: "shadow-amber-500/40", label: "ELEVATED", barFrom: "from-amber-500", barTo: "to-amber-400", pulse: "bg-amber-500" },
  RED: { bg: "from-orange-500 to-orange-600", glow: "shadow-orange-500/40", label: "HIGH THREAT", barFrom: "from-orange-500", barTo: "to-orange-400", pulse: "bg-orange-500" },
  CRITICAL: { bg: "from-red-600 to-red-700", glow: "shadow-red-500/50", label: "CRITICAL", barFrom: "from-red-600", barTo: "to-red-500", pulse: "bg-red-500" }
};

const metricPalettes: Record<string, { value: string; bg: string; border: string; accent: string }> = {
  critical: { value: "text-red-500", bg: "bg-red-500/5", border: "border-red-500/20", accent: "bg-red-500/10" },
  high: { value: "text-orange-500", bg: "bg-orange-500/5", border: "border-orange-500/20", accent: "bg-orange-500/10" },
  medium: { value: "text-amber-500", bg: "bg-amber-500/5", border: "border-amber-500/20", accent: "bg-amber-500/10" },
  low: { value: "text-emerald-500", bg: "bg-emerald-500/5", border: "border-emerald-500/20", accent: "bg-emerald-500/10" },
  neutral: { value: "text-ink", bg: "bg-slate-500/5", border: "border-slate-200", accent: "bg-slate-100" }
};

const severityDot: Record<string, { dot: string; ring: string; pulse: string }> = {
  CRITICAL: { dot: "bg-red-500", ring: "ring-red-500/30", pulse: "bg-red-500" },
  HIGH: { dot: "bg-orange-500", ring: "ring-orange-500/30", pulse: "bg-orange-500" },
  MEDIUM: { dot: "bg-amber-500", ring: "ring-amber-500/30", pulse: "bg-amber-500" },
  LOW: { dot: "bg-emerald-500", ring: "ring-emerald-500/30", pulse: "bg-emerald-500" }
};

function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span>{current}</span>;
}

function ThreatLevelIndicator({ level, generatedAt }: { level: ThreatLevel; generatedAt: string }) {
  const cfg = threatConfig[level];
  const barWidth = level === "GREEN" ? "20%" : level === "AMBER" ? "45%" : level === "RED" ? "70%" : "100%";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-4 w-4">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.pulse}`} />
            <span className={`relative inline-flex h-4 w-4 rounded-full bg-gradient-to-br ${cfg.bg}`} />
          </span>
          <span className={`rounded-md bg-gradient-to-r px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white ${cfg.bg} ${cfg.glow} shadow-lg`}>
            {cfg.label}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          {new Date(generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${cfg.barFrom} ${cfg.barTo} ${cfg.glow} shadow-md transition-all duration-1000 ease-out`}
          style={{ width: barWidth }}
        />
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-white/0 via-white/20 to-white/0" style={{ animation: "pulse 2s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

function MetricPill({ label, value, color, trend, delay }: { label: string; value: number; color: string; trend?: string; delay: number }) {
  const p = metricPalettes[color] ?? metricPalettes.neutral;
  return (
    <div
      className={`rounded-xl ${p.bg} border ${p.border} p-3 transition-all duration-300 hover:border-tide/30 hover:shadow-md`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold tracking-tight ${p.value}`}><AnimatedCounter target={value} /></p>
      {trend && <p className="mt-1 text-[9px] font-semibold text-slate-400">{trend}</p>}
    </div>
  );
}

function PulseMap({ points, delay }: { points: Array<{ lat: number; lng: number; intensity: string; label: string }>; delay: number }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
  });
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const center = useMemo(() => {
    if (points.length === 0) return { lat: 23.8103, lng: 90.4125 };
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat: avgLat, lng: avgLng };
  }, [points]);

  const getMarkerIcon = (intensity: string) => {
    const colorMap: Record<string, string> = {
      critical: "#ef4444",
      high: "#f97316",
      medium: "#eab308",
      low: "#22c55e"
    };
    const color = colorMap[intensity.toLowerCase()] ?? "#64748b";
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 10
    };
  };

  if (!isLoaded) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ animationDelay: `${delay}ms` }}>
        <div className="border-b border-slate-100 px-4 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Live Pulse Map</p>
        </div>
        <div className="flex h-48 w-full items-center justify-center bg-slate-100">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-tide border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ animationDelay: `${delay}ms` }}>
      <div className="border-b border-slate-100 px-4 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Live Pulse Map</p>
      </div>
      <div className="w-full">
        <GoogleMap
          zoom={12}
          center={center}
          mapContainerStyle={{ height: "12rem", width: "100%" }}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            draggable: true,
            scrollwheel: true,
            gestureHandling: "greedy",
            styles: [
              { featureType: "poi", stylers: [{ visibility: "simplified" }] },
              { featureType: "transit", stylers: [{ visibility: "simplified" }] }
            ]
          }}
          onLoad={(map) => { mapRef.current = map; }}
        >
          {points.map((p, i) => (
            <Marker
              key={i}
              position={{ lat: p.lat, lng: p.lng }}
              icon={getMarkerIcon(p.intensity)}
              onClick={() => setSelectedPoint(selectedPoint === i ? null : i)}
            />
          ))}
        </GoogleMap>
      </div>
      {selectedPoint !== null && points[selectedPoint] && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-700">{points[selectedPoint].label}</p>
              <p className="text-[10px] text-slate-400">
                {points[selectedPoint].lat.toFixed(4)}, {points[selectedPoint].lng.toFixed(4)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPoint(null)}
              className="ml-2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineSection({ events, delay }: { events: Array<{ time: string; event: string; severity: string }>; delay: number }) {
  if (events.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ animationDelay: `${delay}ms` }}>
      <div className="border-b border-slate-100 px-4 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Incident Timeline</p>
      </div>
      <div className="px-4 py-3">
        <div className="space-y-0">
          {events.map((e, i) => {
            const d = severityDot[e.severity] ?? severityDot.LOW;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-2 w-2 rounded-full ${d.dot} ring-2 ${d.ring}`} />
                  {i < events.length - 1 && <div className="mt-1 h-6 w-px bg-gradient-to-b from-slate-200 to-transparent" />}
                </div>
                <div className="min-w-0 flex-1 pb-3">
                  <p className="truncate text-xs font-semibold text-slate-700">{e.event}</p>
                  <p className="font-mono text-[10px] text-slate-400">{e.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WarningSection({ warnings, delay }: { warnings: Array<{ zone: string; reason: string; until: string }>; delay: number }) {
  if (warnings.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50" style={{ animationDelay: `${delay}ms` }}>
      <div className="border-b border-amber-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-amber-500">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600">Areas to Avoid</p>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-amber-100">
              <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-amber-900">{w.zone}</p>
                <p className="mt-0.5 text-[10px] text-amber-600">{w.reason}</p>
                <p className="mt-0.5 font-mono text-[9px] text-amber-400">{w.until}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourceSection({ resources, delay }: { resources: Array<{ name: string; qty: string; location: string; eta: string }>; delay: number }) {
  if (resources.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ animationDelay: `${delay}ms` }}>
      <div className="border-b border-slate-100 px-4 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Available Resources</p>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resources.map((r, i) => (
            <div key={i} className="group rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 transition-all hover:border-emerald-400 hover:shadow-sm">
              <p className="text-[11px] font-bold text-emerald-900 group-hover:text-emerald-700">{r.name}</p>
              <p className="mt-0.5 text-[10px] text-emerald-600">{r.qty}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[9px] text-emerald-400">{r.location}</p>
                <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-700">
                  {r.eta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvisorySection({ items, delay }: { items: string[]; delay: number }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ animationDelay: `${delay}ms` }}>
      <div className="border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-tide">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Safety Advisories</p>
        </div>
      </div>
      <div className="p-3">
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-tide" />
              <span className="text-[11px] leading-relaxed text-slate-600">{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SitRepPanel({ lat, lng, radiusKm }: SitRepPanelProps) {
  const [blueprint, setBlueprint] = useState<SitRepBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const prevTimestamp = useRef<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchBlueprint = useCallback(async () => {
    try {
      const data = await getSitRep(lat, lng, radiusKm);
      if (prevTimestamp.current && data.blueprint.generatedAt !== prevTimestamp.current) {
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 600);
      }
      setBlueprint(data.blueprint);
      prevTimestamp.current = data.blueprint.generatedAt;
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Situation Report");
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusKm]);

  useEffect(() => {
    void fetchBlueprint();
    const interval = setInterval(fetchBlueprint, SITREP_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchBlueprint]);

  useEffect(() => {
    const source = openCriticalIncidentStream(lat, lng, radiusKm);
    const handleCriticalIncident = () => { void fetchBlueprint(); };
    source.addEventListener("critical-incident", handleCriticalIncident);
    return () => {
      source.removeEventListener("critical-incident", handleCriticalIncident);
      source.close();
    };
  }, [fetchBlueprint, lat, lng, radiusKm]);

  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity duration-500 ${isUpdating ? "opacity-50" : "opacity-100"}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tide opacity-75" />
            <span className="relative h-3 w-3 rounded-full bg-gradient-to-br from-tide to-cyan-600 shadow-md shadow-tide/30" />
          </span>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">
            Intelligence Briefing
          </h2>
          {blueprint && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400">
              v{blueprint.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchBlueprint()}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-tide"
            title="Refresh"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`}>
              <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}>
              <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
            </svg>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-5 px-6 py-5">
          {loading && !blueprint && (
            <div className="space-y-4">
              <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}

          {blueprint && (
            <div className="animate-[fadeIn_0.4s_ease-out] space-y-4">
              <ThreatLevelIndicator level={blueprint.threatLevel} generatedAt={blueprint.generatedAt} />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {blueprint.metrics.map((m, i) => (
                  <MetricPill key={m.label} {...m} delay={i * 80} />
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <PulseMap points={blueprint.pulseMap} delay={400} />
                <TimelineSection events={blueprint.timeline} delay={500} />
              </div>

              <WarningSection warnings={blueprint.warnings} delay={600} />

              <ResourceSection resources={blueprint.resources} delay={700} />

              <AdvisorySection items={blueprint.advisories} delay={800} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}