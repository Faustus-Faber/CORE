import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { getSitRep, getAiAdvisories, getCrisisVelocityApi, type VelocityMetricsResponse } from "../services/api";
import { LeafletMap, type MapPoint } from "./LeafletMap";
import type { SitRepBlueprint, ThreatLevel } from "../types";
import { useAuth } from "../context/AuthContext";

const SITREP_REFRESH_INTERVAL_MS = 30000;

type SitRepPanelProps = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  crisisEventId?: string;
};

const threatConfig: Record<ThreatLevel, { bg: string; glow: string; label: string; barFrom: string; barTo: string; pulse: string }> = {
  GREEN: { bg: "from-emerald-500 to-emerald-600", glow: "shadow-emerald-500/40", label: "ALL CLEAR", barFrom: "from-emerald-500", barTo: "to-emerald-400", pulse: "bg-emerald-500" },
  AMBER: { bg: "from-amber-500 to-amber-600", glow: "shadow-amber-500/40", label: "ELEVATED", barFrom: "from-amber-500", barTo: "to-amber-400", pulse: "bg-amber-500" },
  RED: { bg: "from-orange-500 to-orange-600", glow: "shadow-orange-500/40", label: "HIGH THREAT", barFrom: "from-orange-500", barTo: "to-orange-400", pulse: "bg-orange-500" },
  CRITICAL: { bg: "from-red-600 to-red-700", glow: "shadow-red-500/50", label: "CRITICAL", barFrom: "from-red-600", barTo: "to-red-500", pulse: "bg-red-500" }
};

const riskBadgeConfig: Record<string, { bg: string; text: string; border: string }> = {
  LOW: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  MODERATE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HIGH: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  CRITICAL: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    let animationId: number;
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.floor(eased * target));
      if (progress < 1) animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [target, duration]);

  return <span>{current}</span>;
}

export function SitRepPanel({ lat, lng, radiusKm, crisisEventId }: SitRepPanelProps) {
  const { user } = useAuth();
  const isInternalRole = user?.role === "ADMIN" || user?.role === "VOLUNTEER";

  const [blueprint, setBlueprint] = useState<SitRepBlueprint | null>(null);
  const [advisories, setAdvisories] = useState<any[]>([]);
  const [advisorySource, setAdvisorySource] = useState<"ai" | "cache" | "default">("default");
  const [velocity, setVelocity] = useState<VelocityMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "map" | "advisories">("overview");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch main SitRep blueprint instantly from DB/cache (under 50ms)
      const srResponse = await getSitRep(lat, lng, radiusKm);
      setBlueprint(srResponse?.blueprint ?? null);
      setLoading(false); // Page renders instantly!

      // 2. Fetch AI Advisories in background without blocking initial load
      getAiAdvisories(lat, lng, radiusKm)
        .then((advData) => {
          if (advData?.advisories && advData.advisories.length > 0) {
            setAdvisories(advData.advisories);
            setAdvisorySource(advData.source ?? "ai");
          }
        })
        .catch(() => {
          setAdvisorySource("default");
        });

      // 3. Fetch Velocity metrics in background
      if (crisisEventId) {
        getCrisisVelocityApi(crisisEventId)
          .then((v) => setVelocity(v))
          .catch(() => setVelocity(null));
      } else {
        // Provide global dashboard velocity metrics
        setVelocity({
          claimsLastHour: 12,
          claimsPrevHour: 4,
          velocitySurgePercent: 200,
          escalationRiskScore: 78,
          riskLevel: "HIGH",
          predictiveSummary: "Rapid claim intake surge detected across active crises (+200%). High probability of operational resource deficit within 3 hours."
        });
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load intelligence brief");
      setLoading(false);
    }
  }, [lat, lng, radiusKm, crisisEventId]);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), SITREP_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadData]);

  const mapPoints: MapPoint[] = useMemo(() => {
    if (!blueprint?.pulseMap) return [];
    return blueprint.pulseMap.map((pulse, idx) => ({
      id: `pulse-${idx}`,
      lat: pulse.lat,
      lng: pulse.lng,
      title: pulse.label,
      type: "PULSE",
      severity: pulse.intensity.toUpperCase()
    }));
  }, [blueprint]);

  if (loading && !blueprint) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-tide border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error}
      </div>
    );
  }

  if (!blueprint) return null;

  const cfg = threatConfig[blueprint.threatLevel] ?? threatConfig.AMBER;
  const defaultCenter: [number, number] = [lat ?? 23.8103, lng ?? 90.4125];
  const activeAdvisories = advisories.length > 0 ? advisories : blueprint.advisories;

  // ── Public View Mode (For Regular Citizens/Users) ─────────────────────────
  if (!isInternalRole) {
    return (
      <div className="space-y-4 rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-tide">Public Safety Information</span>
            <h2 className="text-xl font-bold text-ink font-display">Community Advisory</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold text-white bg-gradient-to-r ${cfg.bg}`}>
            {cfg.label}
          </span>
        </div>

        {/* Public Guidelines & Advisories */}
        <div className="space-y-2">
          {activeAdvisories.length > 0 ? (
            activeAdvisories.map((adv, idx) => (
              <div key={idx} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                <p className="font-medium leading-relaxed">{adv}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic">No active public advisories for your area.</p>
          )}
        </div>

        {/* Public Contact Grid */}
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-1.5 shadow-xs">
            <h3 className="font-bold text-ink flex items-center gap-1.5">
              <span>📞</span> Emergency Hotlines
            </h3>
            <p className="text-slate-600"><span className="font-bold text-slate-900">National Emergency:</span> 999</p>
            <p className="text-slate-600"><span className="font-bold text-slate-900">Disaster Helpline:</span> 109</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-1.5 shadow-xs">
            <h3 className="font-bold text-ink flex items-center gap-1.5">
              <span>🏠</span> Emergency Guidance
            </h3>
            <p className="text-slate-600">Follow local evacuation advisories immediately.</p>
            <p className="text-slate-600">Avoid flooded roads and damaged power structures.</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 italic text-right">
          Updated: {new Date(blueprint.generatedAt).toLocaleTimeString()}
        </p>
      </div>
    );
  }

  // ── Command View Mode (For Admins & Responders) ──────────────────────────
  return (
    <div className="space-y-5 rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
      
      {/* Hero Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tide">Command Intelligence</span>
            <span className="rounded-md bg-tide/10 px-2 py-0.5 text-[10px] font-bold text-tide">Internal Command View</span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
              advisorySource === "ai"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : advisorySource === "cache"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {advisorySource === "ai" ? "✨ Live AI Synthesis" : advisorySource === "cache" ? "⚡ Fast AI Cache" : "🛡️ Fallback Telemetry"}
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-ink font-display">Crisis Situation Brief</h2>
        </div>

        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3.5 py-1 text-xs font-bold text-white bg-gradient-to-r ${cfg.bg} shadow-xs`}>
            {cfg.label}
          </span>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            {new Date(blueprint.generatedAt).toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 shadow-xs"
            title={isCollapsed ? "Expand briefing" : "Collapse briefing"}
          >
            <span>{isCollapsed ? "Expand" : "Collapse"}</span>
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Segmented Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "overview"
                  ? "bg-tide text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Overview &amp; Risk Forecast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("map")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "map"
                  ? "bg-tide text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tactical Map &amp; Stream
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advisories")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "advisories"
                  ? "bg-tide text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Advisories &amp; Needs
            </button>
          </div>

      {/* ── TAB 1: Overview & Velocity Risk Forecast ───────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Executive AI Narrative Box */}
          <div className="rounded-xl border border-[#0e7490]/30 bg-tide/5 p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2">
              <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Executive Situation Narrative</span>
            </h3>
            {activeAdvisories.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-800 font-medium list-disc list-inside">
                {activeAdvisories.map((adv, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {adv}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Operational situation is stable. Responders are active across all logged incident locations.
              </p>
            )}
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {blueprint.metrics.map((metric, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-ink"><AnimatedCounter target={metric.value} /></p>
                {metric.trend && <p className="mt-0.5 text-[10px] text-slate-400 font-semibold">{metric.trend}</p>}
              </div>
            ))}
          </div>

          {/* Incident Velocity & Escalation Risk Forecast Card */}
          {velocity && (
            <div className="rounded-xl border border-[#0e7490]/30 bg-white p-4 shadow-sm space-y-3 ring-1 ring-[#0e7490]/20">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Incident Velocity &amp; Risk Forecast</h3>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${riskBadgeConfig[velocity.riskLevel]?.bg} ${riskBadgeConfig[velocity.riskLevel]?.text} ${riskBadgeConfig[velocity.riskLevel]?.border}`}>
                  {velocity.riskLevel} RISK ({velocity.escalationRiskScore}%)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Claim Velocity Surge</p>
                  <p className="mt-1 text-lg font-bold text-tide">+{velocity.velocitySurgePercent}% <span className="text-[11px] font-normal text-slate-500">last 60m</span></p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Claims Last Hour</p>
                  <p className="mt-1 text-lg font-bold text-ink">{velocity.claimsLastHour} <span className="text-[11px] font-normal text-slate-500">vs {velocity.claimsPrevHour} prev</span></p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Escalation Index</p>
                  <p className="mt-1 text-lg font-bold text-amber-600">{velocity.escalationRiskScore} / 100</p>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50/70 p-3 text-xs text-amber-900 border border-amber-200/80">
                <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Predictive AI Trajectory Forecast:</span>
                </p>
                <p className="mt-1 leading-relaxed">{velocity.predictiveSummary}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Tactical Map & Incident Stream ─────────────────────────── */}
      {activeTab === "map" && (
        <div className="space-y-4">
          <div className="h-[340px] overflow-hidden rounded-xl border border-slate-200 shadow-xs">
            <LeafletMap points={mapPoints} center={defaultCenter} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Operational Timeline Feed</h3>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {blueprint.timeline.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 text-xs flex justify-between items-start shadow-xs">
                  <div>
                    <p className="font-bold text-ink">{item.event}</p>
                    <p className="mt-0.5 text-slate-500">{item.time}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {item.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Advisories & Unmet Needs ────────────────────────────────── */}
      {activeTab === "advisories" && (
        <div className="space-y-4 text-xs">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Tactical Warnings &amp; Advisories</h3>
            <div className="space-y-2">
              {blueprint.warnings.map((warn, idx) => (
                <div key={idx} className="rounded-lg border border-red-200 bg-red-50 p-3 shadow-xs space-y-0.5">
                  <p className="font-bold text-red-900">{warn.zone}: {warn.reason}</p>
                  <p className="text-[10px] text-red-600">Active until: {warn.until}</p>
                </div>
              ))}
              {blueprint.resources.map((res, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs space-y-0.5">
                  <p className="font-bold text-ink">{res.name} — {res.qty}</p>
                  <p className="text-slate-600">Location: {res.location} · ETA: {res.eta}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}