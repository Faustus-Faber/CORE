import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LeafletMap, SEVERITY_COLORS } from "../components/LeafletMap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  getCrisisResponders,
  getCrisisUpdates,
  getIncidentDetail,
  updateMyCrisisResponderStatus
} from "../services/api";
import {
  getTypeIconPath,
  severityBadgeClass,
  timeAgo,
  normalizeMediaUrl,
  isImageFile
} from "../utils/incident";
import { stripThinkingTags } from "../utils/sanitize";
import type {
  CrisisResponder,
  CrisisResponderStatus,
  CrisisUpdateEntry,
  IncidentDetailResponse,
  ContributingReport
} from "../types";
import { ResponseTeamPanel } from "../components/ResponseTeamPanel";
import { CrisisActivityPanel } from "../components/CrisisActivityPanel";
import { CrisisChatPanel } from "../components/CrisisChatPanel";
import { AdminCrisisControls } from "../components/AdminCrisisControls";
import { NGOReportSection } from "../components/NGOReportSection";
import { useAuth } from "../context/AuthContext";

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  VERIFIED: "Verified",
  UNDER_INVESTIGATION: "Under Investigation",
  RESPONSE_IN_PROGRESS: "Response in Progress",
  CONTAINED: "Contained",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

const CAN_UPDATE_ROLES = ["VOLUNTEER", "ADMIN"];

function ContributingReportCard({ report }: { report: ContributingReport }) {
  const [expanded, setExpanded] = useState(false);
  const mediaItems = (report.mediaFilenames ?? []).filter(Boolean);
  const previewItems = expanded ? mediaItems : mediaItems.slice(0, 2);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-ink">{report.classifiedIncidentTitle || report.incidentTitle}</h4>
          <p className="mt-1 text-xs text-slate-600">
            by {report.reporterName} &middot; {timeAgo(report.createdAt)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {report.classifiedIncidentType.replaceAll("_", " ")}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${severityBadgeClass(report.severityLevel)}`}>
              {report.severityLevel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{report.description}</p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
          {report.credibilityScore}
        </span>
      </div>

      {mediaItems.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Evidence ({mediaItems.length})
            </p>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-tide hover:text-tide"
            >
              {expanded ? "Hide" : "Show"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {previewItems.map((mediaPath, index) => {
              const mediaUrl = normalizeMediaUrl(mediaPath);
              if (!mediaUrl) return null;
              return (
                <a
                  key={`${report.id}-${mediaPath}-${index}`}
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-md ring-1 ring-slate-200 transition hover:ring-tide"
                >
                  {isImageFile(mediaPath) ? (
                    <img src={mediaUrl} alt={`Evidence from ${report.reporterName}`} loading="lazy" decoding="async" className="h-24 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-slate-100 text-xs font-medium text-slate-600">
                      File Attachment
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updates, setUpdates] = useState<CrisisUpdateEntry[]>([]);
  const [responders, setResponders] = useState<CrisisResponder[]>([]);
  const [myResponderStatus, setMyResponderStatus] = useState<CrisisResponderStatus | null>(null);
  const [isUpdatingResponder, setIsUpdatingResponder] = useState(false);
  const [responderError, setResponderError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const canManageResponderStatus = user?.role === "VOLUNTEER";
  const canOpenCommandPanel = user != null && CAN_UPDATE_ROLES.includes(user.role);
  const canSubmitCommand =
    user?.role === "ADMIN" ||
    (user?.role === "VOLUNTEER" &&
      myResponderStatus != null &&
      myResponderStatus !== "UNAVAILABLE");

  const loadResponders = async () => {
    if (!id) return;
    const response = await getCrisisResponders(id);
    setResponders(response.responders);
    setMyResponderStatus(response.myStatus);
  };

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [incidentResponse, updatesResponse, responderResponse] = await Promise.all([
        getIncidentDetail(id),
        getCrisisUpdates(id),
        getCrisisResponders(id)
      ]);

      setDetail(incidentResponse.incident);
      setUpdates(updatesResponse.entries);
      setResponders(responderResponse.responders);
      setMyResponderStatus(responderResponse.myStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incident details");
    } finally {
      setLoading(false);
    }
  };

  const handleResponderStatusUpdate = async (nextStatus: CrisisResponderStatus) => {
    if (!id) return;

    setResponderError("");
    setIsUpdatingResponder(true);
    try {
      const response = await updateMyCrisisResponderStatus(id, nextStatus);
      setMyResponderStatus(response.responder.status);
      await loadResponders();
    } catch (err) {
      setResponderError(
        err instanceof Error ? err.message : "Failed to update responder status"
      );
    } finally {
      setIsUpdatingResponder(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const [incidentResponse, updatesResponse, responderResponse] = await Promise.all([
          getIncidentDetail(id),
          getCrisisUpdates(id),
          getCrisisResponders(id)
        ]);
        if (cancelled) return;
        setDetail(incidentResponse.incident);
        setUpdates(updatesResponse.entries);
        setResponders(responderResponse.responders);
        setMyResponderStatus(responderResponse.myStatus);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load incident details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void doFetch();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center ring-1 ring-red-200">
        <p className="text-sm font-semibold text-red-700">{error || "Incident not found"}</p>
        <Link to="/dashboard" className="mt-3 inline-block text-sm text-tide hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { crisisEvent, commandCenter, contributingReports, nearbyResources } = detail;
  const mapCenter: [number, number] = crisisEvent.latitude && crisisEvent.longitude
    ? [crisisEvent.latitude, crisisEvent.longitude]
    : [23.8103, 90.4125];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link to="/dashboard" className="text-tide hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-400">{crisisEvent.title}</span>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
              <path d={getTypeIconPath(crisisEvent.incidentType)} />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink">{crisisEvent.title}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityBadgeClass(crisisEvent.severityLevel)}`}>
                {crisisEvent.severityLevel}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {STATUS_LABEL[crisisEvent.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{crisisEvent.locationText}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>{crisisEvent.reportCount} report{crisisEvent.reportCount !== 1 ? "s" : ""} merged</span>
              <span>{crisisEvent.reporterCount} reporter{crisisEvent.reporterCount !== 1 ? "s" : ""}</span>
              <span>Created {timeAgo(crisisEvent.createdAt)}</span>
            </div>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-tide px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Coordination Chat</span>
            </button>
          )}
        </div>
      </section>

      {crisisEvent.sitRepText && (
        <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Situation Update</h2>
          <div className="sitrep-content mt-2 text-sm leading-relaxed text-slate-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripThinkingTags(crisisEvent.sitRepText)}
            </ReactMarkdown>
          </div>
          <style>{`
            .sitrep-content p { margin-bottom: 0.625rem; }
            .sitrep-content p:last-child { margin-bottom: 0; }
            .sitrep-content strong { color: #1f2a37; font-weight: 600; }
            .sitrep-content ul,
            .sitrep-content ol {
              list-style: none;
              padding: 0;
              margin: 0.5rem 0;
              display: flex;
              flex-direction: column;
              gap: 0.375rem;
            }
            .sitrep-content li {
              position: relative;
              padding-left: 1.25rem;
              line-height: 1.6;
            }
            .sitrep-content li::before {
              content: "";
              position: absolute;
              left: 0;
              top: 0.55em;
              width: 0.45rem;
              height: 0.45rem;
              border-radius: 50%;
              background: #0e7490;
              opacity: 0.6;
            }
          `}</style>
        </section>
      )}

      {crisisEvent.latitude && crisisEvent.longitude && (
        <section className="overflow-hidden rounded-xl shadow-panel ring-1 ring-slate-200">
          <LeafletMap
            center={mapCenter}
            zoom={14}
            height="256px"
            points={[{ lat: mapCenter[0], lng: mapCenter[1], color: SEVERITY_COLORS[crisisEvent.severityLevel] ?? "#ef4444" }]}
          />
        </section>
      )}

      {nearbyResources.length > 0 && (
        <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Nearby Resources</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {nearbyResources.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-ink">{r.name}</p>
                <p className="text-xs text-slate-600">{r.quantity} {r.unit} &middot; {r.status}</p>
                <p className="mt-1 text-[11px] text-slate-500">{r.address}{r.distanceKm != null ? ` (${r.distanceKm.toFixed(1)} km)` : ""}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <ResponseTeamPanel
        responders={responders}
        myStatus={myResponderStatus}
        myTrustTier={user?.trustTier}
        myObservationCount={responders.find((r) => r.volunteerId === user?.id)?.observationCount ?? 0}
        myResourceNeedCount={responders.find((r) => r.volunteerId === user?.id)?.resourceNeedCount ?? 0}
        crisisNeeds={commandCenter.resourceNeeds}
        canOptIn={canManageResponderStatus}
        isUpdating={isUpdatingResponder}
        responderError={responderError}
        onStatusUpdate={(status) => void handleResponderStatusUpdate(status)}
      />

      <CrisisActivityPanel
        crisisEventId={crisisEvent.id}
        crisisStatus={crisisEvent.status}
        crisisSeverity={crisisEvent.severityLevel}
        commandCenter={commandCenter}
        updates={updates}
        isAdmin={isAdmin}
        userTrustTier={user?.trustTier}
        canSubmitCommand={canSubmitCommand}
        canOpenCommandPanel={canOpenCommandPanel}
        onRefresh={() => void fetchDetail()}
      />

      {isAdmin && (
        <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Admin Controls
          </h2>
          <div className="mt-4">
            <AdminCrisisControls
              crisisEventId={crisisEvent.id}
              currentStatus={crisisEvent.status}
              onReverted={() => void fetchDetail()}
            />
          </div>
        </section>
      )}

      {isAdmin && (
        <NGOReportSection
          crisisEventId={crisisEvent.id}
          status={crisisEvent.status}
          isAdmin={isAdmin}
        />
      )}

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Contributing Reports ({contributingReports.length})
        </h2>
        <div className="mt-4 space-y-3">
          {contributingReports.map((report) => (
            <ContributingReportCard key={report.id} report={report} />
          ))}
        </div>
      </section>

      {/* Crisis Coordination Chat — glassmorphism popup */}
      <CrisisChatPanel
        crisisEventId={crisisEvent.id}
        crisisTitle={crisisEvent.title}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
