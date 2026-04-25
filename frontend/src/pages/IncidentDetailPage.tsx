import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
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
  CrisisAccessStatus,
  CrisisResponder,
  CrisisResponderStatus,
  CrisisUpdateEntry,
  CrisisUpdateType,
  IncidentDetailResponse,
  ContributingReport
} from "../types";
import { CrisisUpdateForm } from "../components/CrisisUpdateForm";
import { UpdateTimeline } from "../components/UpdateTimeline";
import { AdminCrisisControls } from "../components/AdminCrisisControls";
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

const RESPONDER_STATUS_LABEL: Record<CrisisResponderStatus, string> = {
  RESPONDING: "Responding",
  EN_ROUTE: "En Route",
  ON_SITE: "On Site",
  COMPLETED: "Completed",
  UNAVAILABLE: "Unavailable"
};

const UPDATE_TYPE_LABEL: Record<CrisisUpdateType, string> = {
  STATUS_CHANGE: "Status Change",
  FIELD_OBSERVATION: "Field Observation",
  ACCESS_UPDATE: "Access Update",
  IMPACT_UPDATE: "Impact Update",
  RESOURCE_NEED: "Resource Need",
  CLOSURE_NOTE: "Closure Note",
  ADMIN_CORRECTION: "Admin Correction",
  RESPONDER_STATUS: "Responder Status"
};

const ACCESS_STATUS_LABEL: Record<CrisisAccessStatus, string> = {
  OPEN: "Open",
  LIMITED: "Limited",
  BLOCKED: "Blocked",
  UNKNOWN: "Unknown"
};

const NEXT_RESPONDER_STATUSES: Record<CrisisResponderStatus, CrisisResponderStatus[]> = {
  RESPONDING: ["EN_ROUTE", "ON_SITE", "COMPLETED", "UNAVAILABLE"],
  EN_ROUTE: ["ON_SITE", "COMPLETED", "UNAVAILABLE"],
  ON_SITE: ["COMPLETED", "UNAVAILABLE"],
  COMPLETED: ["RESPONDING", "UNAVAILABLE"],
  UNAVAILABLE: ["RESPONDING"]
};

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
                    <img src={mediaUrl} alt={`Evidence from ${report.reporterName}`} loading="lazy" className="h-24 w-full object-cover" />
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
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
  });

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
    void fetchDetail();
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
  const mapCenter = crisisEvent.latitude && crisisEvent.longitude
    ? { lat: crisisEvent.latitude, lng: crisisEvent.longitude }
    : { lat: 23.8103, lng: 90.4125 };
  const nextResponderStatuses: CrisisResponderStatus[] = myResponderStatus
    ? NEXT_RESPONDER_STATUSES[myResponderStatus]
    : ["RESPONDING"];

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

      {isLoaded && crisisEvent.latitude && crisisEvent.longitude && (
        <section className="overflow-hidden rounded-xl shadow-panel ring-1 ring-slate-200">
          <GoogleMap
            zoom={14}
            center={mapCenter}
            mapContainerClassName="h-64 w-full"
            options={{ disableDefaultUI: true, zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
          >
            <Marker position={mapCenter} />
          </GoogleMap>
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

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Field Intelligence Snapshot
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Verified command intelligence compiled from responder and admin updates.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {commandCenter.lastVerifiedAt
              ? `Last verified ${timeAgo(commandCenter.lastVerifiedAt)}`
              : "No verified field update yet"}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Verification
            </p>
            <p className="mt-2 text-base font-semibold text-ink">
              {commandCenter.lastVerifiedBy ?? "Awaiting field confirmation"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {commandCenter.latestUpdateType
                ? UPDATE_TYPE_LABEL[commandCenter.latestUpdateType]
                : "No command update yet"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Access
            </p>
            <p className="mt-2 text-base font-semibold text-ink">
              {commandCenter.accessStatus
                ? ACCESS_STATUS_LABEL[commandCenter.accessStatus]
                : "No access update"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {commandCenter.affectedArea ?? "Affected area has not been refined yet."}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Impact
            </p>
            <p className="mt-2 text-base font-semibold text-ink">
              {commandCenter.casualtyCount != null
                ? `${commandCenter.casualtyCount} casualties`
                : "No casualty estimate"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {commandCenter.displacedCount != null
                ? `${commandCenter.displacedCount} displaced`
                : "No displacement estimate"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Responders
            </p>
            <p className="mt-2 text-base font-semibold text-ink">
              {commandCenter.activeResponderCount} active
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {commandCenter.responderCounts.ON_SITE} on site / {commandCenter.responderCounts.EN_ROUTE} en route
            </p>
          </article>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Current Command Note
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {commandCenter.latestNote ?? "No command note has been published yet."}
            </p>
            {commandCenter.damageNotes && (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-800">Damage: </span>
                {commandCenter.damageNotes}
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Urgent Needs
            </p>
            {commandCenter.resourceNeeds.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No urgent resource needs are currently recorded.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {commandCenter.resourceNeeds.map((need) => (
                  <span
                    key={`${crisisEvent.id}-${need}`}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    {need}
                  </span>
                ))}
              </div>
            )}

            {commandCenter.closureChecklist && (
              <div className="mt-4 grid gap-2">
                {[
                  {
                    label: "Area safe",
                    value: commandCenter.closureChecklist.areaSafe
                  },
                  {
                    label: "People accounted",
                    value: commandCenter.closureChecklist.peopleAccounted
                  },
                  {
                    label: "Urgent needs stabilised",
                    value: commandCenter.closureChecklist.urgentNeedsStabilized
                  }
                ].map((item) => (
                  <div
                    key={`${crisisEvent.id}-${item.label}`}
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      item.value
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Responder Report Card
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {responders.length} responder{responders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {canManageResponderStatus && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-ink">
              Your status: {myResponderStatus ? RESPONDER_STATUS_LABEL[myResponderStatus] : "Not opted in"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextResponderStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={isUpdatingResponder}
                  onClick={() => void handleResponderStatusUpdate(status)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide disabled:opacity-60"
                >
                  {isUpdatingResponder
                    ? "Updating..."
                    : status === "RESPONDING" && !myResponderStatus
                      ? "Opt In to Respond"
                      : `Mark ${RESPONDER_STATUS_LABEL[status]}`}
                </button>
              ))}
            </div>
            {responderError && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {responderError}
              </p>
            )}
          </div>
        )}

        {responders.length === 0 ? (
          <p className="text-sm text-slate-500">No volunteers have opted in for this crisis yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {responders.map((responder) => (
              <article key={responder.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{responder.volunteerName}</p>
                    <p className="mt-1 text-xs text-slate-500">{responder.location || "Location unavailable"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {RESPONDER_STATUS_LABEL[responder.status]}
                  </span>
                </div>
                {responder.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {responder.skills.slice(0, 4).map((skill) => (
                      <span
                        key={`${responder.id}-${skill}`}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  Last update: {new Date(responder.lastStatusAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Incident Command
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Structured field intelligence, verified updates, and audit-ready command history.
            </p>
          </div>
          {canSubmitCommand && (
            <button
              type="button"
              onClick={() => setShowUpdateForm((value) => !value)}
              className="rounded-xl bg-tide px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
            >
              {showUpdateForm ? "Hide Composer" : "New Command Update"}
            </button>
          )}
        </div>

        {canSubmitCommand && showUpdateForm && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <CrisisUpdateForm
              crisisEventId={crisisEvent.id}
              currentStatus={crisisEvent.status}
              isAdmin={isAdmin}
              onSubmit={() => {
                setShowUpdateForm(false);
                void fetchDetail();
              }}
            />
          </div>
        )}

        {canOpenCommandPanel && !canSubmitCommand && user?.role === "VOLUNTEER" && (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            Opt in from the responder report card to publish crisis-scoped field intelligence.
          </div>
        )}

        {!canOpenCommandPanel && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Sign in as an active responder or admin to publish command updates. The verified timeline remains visible to all authenticated users.
          </div>
        )}

        {isAdmin && (
          <AdminCrisisControls
            crisisEventId={crisisEvent.id}
            currentStatus={crisisEvent.status}
            onReverted={() => void fetchDetail()}
          />
        )}

        <UpdateTimeline
          entries={updates}
          isAdmin={isAdmin}
          onRefresh={() => void fetchDetail()}
        />
      </section>

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
    </div>
  );
}
