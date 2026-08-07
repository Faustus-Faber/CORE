import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../services/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { ClaimsPanel } from "../components/ClaimsPanel";
import { EvidenceFactorsPanel } from "../components/EvidenceFactorsPanel";
import { CreateEvidenceInCrisis } from "../components/CreateEvidenceInCrisis";
import { EvidenceItemCard } from "../components/EvidenceItemCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopilotPanel } from "../components/CopilotPanel";
import { ActionDraftsPanel } from "../components/ActionDraftsPanel";
import { LeafletMap, SEVERITY_COLORS } from "../components/LeafletMap";
import { ErrorState } from "../components/ui/ErrorState";
import { severityBadgeClass, timeAgo, getTypeIconPath } from "../utils/incident";
import type { EvidenceSummary } from "../types/evidence";

// ── Types ────────────────────────────────────────────────────────────────────

interface CrisisEvent {
  id: string;
  title: string;
  status: string;
  severityLevel: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  reportCount: number;
  incidentType?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceData {
  crisis: CrisisEvent;
  claims: Array<{
    id: string;
    claimType: string;
    subject: string;
    value: string;
    evidenceState: string;
    conflictCount: number;
    supportCount: number;
    needsHumanDecision?: boolean;
  }>;
  needs: Array<{
    id: string;
    needType: string;
    description: string;
    quantity: number;
    unit: string;
    isMet: boolean;
    urgency: string;
  }>;
  assignments: Array<{
    id: string;
    status: string;
    volunteer: { fullName: string };
  }>;
  responders: Array<{
    id: string;
    status: string;
    volunteer: { fullName: string; skills?: string[] };
    optedInAt: string;
    lastStatusAt: string;
  }>;
  updates: Array<{
    id: string;
    updateType: string;
    updateNote: string;
    newStatus: string;
    verificationStatus: string | null;
    createdAt: string;
  }>;
  evidencePosts?: Array<{
    id: string;
    title: string;
    description: string;
    mediaUrls: string[];
    mediaType: string;
    isVerified: boolean;
    visibility: string;
    uploaderName: string;
    uploaderAvatar?: string | null;
    createdAt: string;
  }>;
  ocrScans?: Array<{
    id: string;
    rawText: string;
    sourceImageUrl: string;
    createdAt: string;
  }>;
  evidenceSummary?: EvidenceSummary | null;
}

/** Split the combined AI summary + raw OCR text into separate parts */
function parseOcrText(rawText: string) {
  if (rawText.includes("--- AI SCENARIO SUMMARY ---")) {
    const parts = rawText.split("--- RAW EXTRACTED TEXT ---");
    const aiPart = parts[0].replace("--- AI SCENARIO SUMMARY ---", "").trim();
    const rawPart = parts[1] ? parts[1].trim() : "";
    return { aiSummary: aiPart, rawExtracted: rawPart };
  }
  return { aiSummary: null, rawExtracted: rawText };
}

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  REPORTED:             { label: "Reported",      badge: "bg-amber-100 text-amber-800 border-amber-200" },
  VERIFIED:             { label: "Verified",      badge: "bg-teal-100 text-teal-800 border-teal-200" },
  UNDER_INVESTIGATION:  { label: "Investigating", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  RESPONSE_IN_PROGRESS: { label: "Responding",    badge: "bg-rose-100 text-rose-800 border-rose-200" },
  CONTAINED:            { label: "Contained",     badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  RESOLVED:             { label: "Resolved",      badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  CLOSED:               { label: "Closed",        badge: "bg-slate-200 text-slate-700 border-slate-300" },
};

const ASSIGNMENT_CONFIG: Record<string, { label: string; cls: string }> = {
  PROPOSED:  { label: "Proposed",  cls: "bg-slate-100 text-slate-600" },
  OFFERED:   { label: "Offered",   cls: "bg-blue-50 text-blue-600" },
  ACCEPTED:  { label: "Accepted",  cls: "bg-indigo-50 text-indigo-600" },
  EN_ROUTE:  { label: "En Route",  cls: "bg-cyan-50 text-tide font-semibold" },
  ON_SITE:   { label: "On Site",   cls: "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-600 text-white" },
  DECLINED:  { label: "Declined",  cls: "bg-slate-100 text-slate-400" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-400" },
  EXPIRED:   { label: "Expired",   cls: "bg-slate-100 text-slate-400" },
};

const RESPONDER_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  RESPONDING:  { label: "Responding",  cls: "bg-cyan-50 text-tide font-semibold" },
  EN_ROUTE:    { label: "En Route",    cls: "bg-cyan-50 text-tide font-semibold" },
  ON_SITE:     { label: "On Site",     cls: "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200" },
  COMPLETED:   { label: "Completed",   cls: "bg-emerald-600 text-white" },
  OFF_DUTY:    { label: "Off Duty",    cls: "bg-slate-100 text-slate-400" },
};

const FILTERS = ["ALL", "REPORTED", "VERIFIED", "RESPONSE_IN_PROGRESS", "CONTAINED", "RESOLVED"] as const;

type Tab = "copilot" | "evidence" | "needs" | "timeline";
type SortOption = "recency" | "severity" | "reports";

function fmtTime(iso: string): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// ── Operations Workspace Page with Signature CORE Card Border Glow ───────────

export function OperationsWorkspacePage() {
  const [crises, setCrises] = useState<CrisisEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  
  // Controls & Filters
  const [filter, setFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recency");
  const [tab, setTab] = useState<Tab>("copilot");
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);

  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const fetchCrises = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const response = await apiFetch(`/dashboard/feed?sortBy=mostRecent&sortOrder=desc`);
      if (!response.ok) throw new Error("Failed to load crisis feed");
      const data = await response.json();
      const events: CrisisEvent[] = data.feed ?? data.events ?? [];
      setCrises(events);
      setSelectedId((prev) => prev ?? events[0]?.id ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const fetchWorkspace = useCallback(async (crisisId: string) => {
    try {
      setWorkspaceLoading(true);
      const response = await apiFetch(`/crises/${crisisId}/workspace`);
      if (response.ok) {
        const json = await response.json();
        setWorkspace(json.data ?? json);
      }
    } catch {
      showToastRef.current("Failed to load crisis details", "error");
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => { fetchCrises(); }, [fetchCrises]);
  useEffect(() => { if (selectedId) fetchWorkspace(selectedId); }, [selectedId, fetchWorkspace]);

  // Search & Filter Logic
  const filteredCrises = crises
    .filter((c) => {
      const matchesFilter = filter === "ALL" || c.status === filter;
      const matchesSearch =
        searchQuery.trim() === "" ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.locationText.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "severity") {
        const sevOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (sevOrder[b.severityLevel] ?? 0) - (sevOrder[a.severityLevel] ?? 0);
      }
      if (sortBy === "reports") {
        return b.reportCount - a.reportCount;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const unmetNeeds = (workspace?.needs ?? []).filter((n) => !n.isMet);
  const activeAssignments = (workspace?.assignments ?? []).filter(
    (a) => !["COMPLETED", "CANCELLED", "DECLINED", "EXPIRED"].includes(a.status)
  );
  const activeResponders = (workspace?.responders ?? []).filter(
    (r) => !["COMPLETED", "OFF_DUTY"].includes(r.status)
  );
  const conflictedClaims = (workspace?.claims ?? []).filter(
    (c) => c.evidenceState === "CONFLICTED" || c.conflictCount > 0
  );

  const mapPoints = filteredCrises
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({
      lat: c.latitude!,
      lng: c.longitude!,
      color: SEVERITY_COLORS[c.severityLevel] ?? "#64748b",
      popupHtml: `<strong>${c.title}</strong><br/>${STATUS_CONFIG[c.status]?.label ?? c.status}`,
    }));

  const sel = workspace?.crisis;
  const mapCenter: [number, number] = sel?.latitude != null && sel?.longitude != null
    ? [sel.latitude, sel.longitude]
    : mapPoints[0] ? [mapPoints[0].lat, mapPoints[0].lng] : [23.8103, 90.4125];

  return (
    <div className="space-y-6">
      
      {/* ── 1. Page Title Header Card ──────────────────────────────────────── */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
            Operations Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Coordinate emergency response, review copilot action drafts, and evaluate evidence claims.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/report-incident"
            className="inline-flex items-center gap-2 rounded-lg bg-tide px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-tide/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Submit Incident</span>
          </Link>

          <button
            onClick={() => void fetchCrises()}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm ring-1 ring-slate-100 transition hover:border-tide hover:text-tide"
            title="Refresh feed"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {loadError && !loading && (
        <ErrorState
          message="Failed to load crisis feed"
          detail="Could not establish connection to the backend server."
          onRetry={() => void fetchCrises()}
        />
      )}

      {/* ── 2. Top Telemetry Stat Cards Grid with Signature Cyan Border ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Claims & Evidence</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{workspace?.claims?.length ?? 0}</p>
          <p className={`text-xs mt-1 font-medium ${conflictedClaims.length > 0 ? "text-red-600 font-bold" : "text-tide"}`}>
            {conflictedClaims.length > 0 ? `${conflictedClaims.length} Conflicted` : "No Conflicts"}
          </p>
        </div>

        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unmet Resource Needs</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{unmetNeeds.length}</p>
          <p className="text-xs text-slate-500 mt-1">out of {workspace?.needs?.length ?? 0} total</p>
        </div>

        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Field Responders</p>
          <p className="mt-1.5 text-2xl font-bold text-ink">{activeResponders.length}</p>
          <p className="text-xs text-slate-500 mt-1">opted in & responding</p>
        </div>

        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Telemetry Update</p>
          <p className="mt-1.5 text-lg font-bold text-ink">{timeAgo(workspace?.crisis?.updatedAt ?? "")}</p>
          <p className="text-xs text-slate-500 mt-1 truncate">{fmtTime(workspace?.crisis?.updatedAt ?? "")}</p>
        </div>
      </div>

      {/* ── 3. 2-Column Responsive Workspace Grid with Signature Cyan Borders ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {workspaceLoading ? (
            <div className="space-y-4">
              <div className="h-28 bg-white rounded-xl animate-pulse border border-[#0e7490]/30" />
              <div className="h-80 bg-white rounded-xl animate-pulse border border-[#0e7490]/30" />
            </div>
          ) : workspace ? (
            <>
              {/* Selected Incident Header Card */}
              <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-ink font-display">
                        {workspace.crisis?.title}
                      </h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${severityBadgeClass((workspace.crisis?.severityLevel ?? "LOW") as any)}`}>
                        {workspace.crisis?.severityLevel}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                        (STATUS_CONFIG[workspace.crisis?.status] ?? STATUS_CONFIG.REPORTED).badge
                      }`}>
                        {(STATUS_CONFIG[workspace.crisis?.status] ?? STATUS_CONFIG.REPORTED).label}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {workspace.crisis?.locationText}
                    </p>
                  </div>

                  <Link
                    to={`/dashboard/incidents/${workspace.crisis?.id ?? selectedId ?? ""}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-tide/10 px-3 py-1.5 text-xs font-semibold text-tide hover:bg-tide hover:text-white transition"
                  >
                    <span>View Full Incident File</span>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Spatial Intelligence Map Card */}
              <div className="rounded-xl border border-[#0e7490]/30 bg-white p-4 shadow-panel ring-1 ring-[#0e7490]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink font-display flex items-center gap-2">
                    <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>Spatial Intelligence Map</span>
                  </h3>
                  <button
                    onClick={() => setIsMapExpanded((prev) => !prev)}
                    className="text-xs font-semibold text-tide hover:underline flex items-center gap-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={isMapExpanded ? "M9 9L4 4m0 0l5 0m-5 0l0 5m11 5l5 5m0 0l-5 0m5 0l0-5" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
                    </svg>
                    <span>{isMapExpanded ? "Collapse Map" : "Expand Map"}</span>
                  </button>
                </div>

                <div className={`rounded-lg overflow-hidden border border-slate-200 transition-all duration-300 ${
                  isMapExpanded ? "h-[450px]" : "h-80 sm:h-96"
                }`}>
                  <LeafletMap
                    center={mapCenter}
                    zoom={13}
                    points={mapPoints}
                    height="100%"
                    fitBounds={mapPoints.length > 1}
                  />
                </div>
              </div>

              {/* Operational Workspace Tabs Card */}
              <div className="rounded-xl border border-[#0e7490]/30 bg-white shadow-panel ring-1 ring-[#0e7490]/20 overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50/60 px-4 overflow-x-auto no-scrollbar">
                  {[
                    {
                      id: "copilot" as Tab,
                      label: "Action Center & Copilot",
                      badge: 0,
                      iconSvg: (
                        <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )
                    },
                    {
                      id: "evidence" as Tab,
                      label: "Claims & Evidence",
                      badge: conflictedClaims.length,
                      iconSvg: (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    },
                    {
                      id: "needs" as Tab,
                      label: "Needs & Responders",
                      badge: 0,
                      iconSvg: (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      )
                    },
                    {
                      id: "timeline" as Tab,
                      label: "Operational Timeline",
                      badge: 0,
                      iconSvg: (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        tab === t.id
                          ? "border-tide text-tide bg-white"
                          : "border-transparent text-slate-600 hover:text-ink hover:bg-slate-100/50"
                      }`}
                    >
                      {t.iconSvg}
                      <span>{t.label}</span>
                      {t.badge > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-600 text-white">
                          {t.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* TAB 1: COPILOT AI & DRAFTS */}
                  {tab === "copilot" && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-ink font-display mb-3">Emergency AI Copilot Intelligence</h3>
                        <CopilotPanel
                          crisisEventId={selectedId ?? ""}
                          isAdmin={isAdmin}
                          onDraftCreated={() => setDraftRefreshKey((k) => k + 1)}
                        />
                      </div>

                      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-ink font-display mb-3">Action Drafts for Review</h3>
                        <ActionDraftsPanel
                          crisisEventId={selectedId ?? ""}
                          isAdmin={isAdmin}
                          refreshKey={draftRefreshKey}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CLAIMS & EVIDENCE */}
                  {tab === "evidence" && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Upload evidence to this crisis */}
                      {selectedId && (user?.role === "ADMIN" || user?.role === "VOLUNTEER") && (
                        <CreateEvidenceInCrisis
                          crisisEventId={selectedId}
                          onEvidenceCreated={() => selectedId && fetchWorkspace(selectedId)}
                        />
                      )}

                      {/* Claims with contradiction detection */}
                      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-ink font-display mb-3">Claims & Contradictions</h3>
                        <ClaimsPanel crisisEventId={selectedId ?? ""} isAdmin={isAdmin} />
                      </div>

                      {/* Evidence items with OCR action */}
                      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-ink font-display">
                            Crisis Evidence ({(workspace.evidencePosts ?? []).length})
                          </h3>
                        </div>

                        {(workspace.evidencePosts ?? []).length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-400">
                            No evidence uploaded for this crisis yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(workspace.evidencePosts ?? []).map((post) => (
                              <EvidenceItemCard
                                key={post.id}
                                evidence={post}
                                crisisEventId={selectedId ?? ""}
                                isAdmin={isAdmin}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* OCR scans linked to this crisis */}
                      {(workspace.ocrScans ?? []).length > 0 && (
                        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                          <h3 className="text-sm font-bold text-ink font-display mb-3">
                            OCR Scans ({(workspace.ocrScans ?? []).length})
                          </h3>
                          <div className="space-y-2">
                            {(workspace.ocrScans ?? []).map((scan) => {
                              const { aiSummary, rawExtracted } = parseOcrText(scan.rawText);
                              return (
                                <div key={scan.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={scan.sourceImageUrl}
                                      alt="OCR source"
                                      className="h-10 w-10 rounded object-cover border border-slate-200"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-ink">OCR Scan</p>
                                      <p className="text-[10px] text-slate-400">{new Date(scan.createdAt).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  {aiSummary && (
                                    <div className="mt-2 text-xs leading-relaxed text-slate-800 prose prose-xs max-w-none prose-headings:text-ink prose-strong:text-ink prose-p:my-1 line-clamp-3">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {aiSummary}
                                      </ReactMarkdown>
                                    </div>
                                  )}
                                  {rawExtracted && (
                                    <p className="mt-2 text-xs text-slate-700 line-clamp-3 whitespace-pre-wrap">
                                      {rawExtracted}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* AI Evidence & Credibility Summary */}
                      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-ink font-display mb-3">AI Evidence & Credibility Summary</h3>
                        <EvidenceFactorsPanel summary={workspace.evidenceSummary ?? null} />
                      </div>
                    </div>
                  )}

                  {/* TAB 3: NEEDS & RESPONDERS */}
                  {tab === "needs" && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                          <h3 className="text-sm font-bold text-ink font-display mb-2">Resource Needs ({unmetNeeds.length} unmet)</h3>
                          {(workspace.needs ?? []).length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No needs logged for this crisis.</p>
                          ) : (
                            <div className="divide-y divide-slate-200">
                              {(workspace.needs ?? []).map((need) => (
                                <div key={need.id} className="py-2 flex items-center justify-between text-xs">
                                  <div>
                                    <p className="font-semibold text-ink">{need.needType}</p>
                                    <p className="text-[11px] text-slate-500">{need.description}</p>
                                  </div>
                                  <span className="font-mono font-bold text-slate-700">{need.quantity} {need.unit}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                          <h3 className="text-sm font-bold text-ink font-display mb-2">Active Field Responders</h3>
                          {(workspace.responders ?? []).length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No responders opted in yet.</p>
                          ) : (
                            <div className="divide-y divide-slate-200">
                              {(workspace.responders ?? []).map((r) => {
                                const rs = RESPONDER_STATUS_CONFIG[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-600" };
                                return (
                                  <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-ink">{r.volunteer.fullName}</span>
                                      {r.volunteer.skills && r.volunteer.skills.length > 0 && (
                                        <span className="text-[10px] text-slate-400">({r.volunteer.skills.slice(0, 2).join(", ")})</span>
                                      )}
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${rs.cls}`}>{rs.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: TIMELINE */}
                  {tab === "timeline" && (
                    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 animate-fade-in">
                      <h3 className="text-sm font-bold text-ink font-display mb-3">Operational Activity Timeline</h3>
                      {(workspace.updates ?? []).length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center">No updates logged.</p>
                      ) : (
                        <div className="space-y-3">
                          {(workspace.updates ?? []).map((update) => (
                            <div key={update.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-sm">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-bold text-ink capitalize">{update.updateType.replace(/_/g, " ").toLowerCase()}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{fmtTime(update.createdAt)}</span>
                              </div>
                              <p className="text-slate-600">{update.updateNote}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-[#0e7490]/30 bg-white p-12 text-center text-xs text-slate-500 shadow-panel ring-1 ring-[#0e7490]/20">
              Select an incident from the feed to load details.
            </div>
          )}
        </div>

        {/* Right Sidebar: Crisis Events Feed Cards with Signature Cyan Border */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-[#0e7490]/30 bg-white p-4 shadow-panel ring-1 ring-[#0e7490]/20 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink font-display">Crisis Events</h2>
              <span className="text-xs font-semibold text-tide bg-tide/10 px-2.5 py-0.5 rounded-full">{filteredCrises.length} active</span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search crises..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-tide focus:ring-1 focus:ring-tide shadow-xs"
              />
              <svg className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>

            {/* Status Filter & Sort Controls */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-tide"
              >
                <option value="ALL">All Statuses</option>
                {FILTERS.filter(f => f !== "ALL").map(f => (
                  <option key={f} value={f}>{STATUS_CONFIG[f]?.label ?? f}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-tide"
              >
                <option value="recency">Most Recent</option>
                <option value="severity">Highest Severity</option>
                <option value="reports">Most Reports</option>
              </select>
            </div>
          </div>

          {/* Incident Feed Cards with Signature Cyan Border */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200/60" />
                ))}
              </div>
            ) : filteredCrises.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-[#0e7490]/30 shadow-panel ring-1 ring-[#0e7490]/20">
                No matching events found.
              </div>
            ) : (
              filteredCrises.map((crisis) => {
                const isSelected = selectedId === crisis.id;
                const st = STATUS_CONFIG[crisis.status] ?? STATUS_CONFIG.REPORTED;

                return (
                  <div
                    key={crisis.id}
                    onClick={() => setSelectedId(crisis.id)}
                    className={`rounded-xl border p-4 shadow-panel transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#0e7490]/80 bg-tide/5 ring-1 ring-[#0e7490]/40 shadow-md"
                        : "border-[#0e7490]/30 bg-white ring-1 ring-[#0e7490]/20 hover:border-[#0e7490]/60 hover:ring-[#0e7490]/30 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Category SVG Icon */}
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? "bg-tide text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                          <path d={getTypeIconPath((crisis.incidentType ?? "FLOOD") as any)} />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`text-xs font-bold truncate font-display ${isSelected ? "text-tide" : "text-ink"}`}>
                            {crisis.title}
                          </h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 flex-shrink-0 ${severityBadgeClass(crisis.severityLevel as any)}`}>
                            {crisis.severityLevel}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500 flex items-center gap-1 truncate">
                          <svg className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {crisis.locationText}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between text-xs">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${st.badge}`}>
                            {st.label}
                          </span>
                          <span className="text-slate-500 font-medium">
                            {crisis.reportCount} rep • {timeAgo(crisis.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
