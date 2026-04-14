import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

import { getIncidentDetail } from "../services/api";
import {
  getTypeIconPath,
  severityBadgeClass,
  timeAgo,
  normalizeMediaUrl,
  isImageFile
} from "../utils/incident";
import type { IncidentDetailResponse, ContributingReport } from "../types";
import { CrisisUpdateForm } from "../components/CrisisUpdateForm";
import { UpdateTimeline } from "../components/UpdateTimeline";
import { getCrisisUpdates, CrisisUpdateEntry } from "../services/api";
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
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
  });

  const canUpdate = user != null && CAN_UPDATE_ROLES.includes(user.role);

  const loadUpdates = () => {
    if (id) {
      getCrisisUpdates(id).then((data) => setUpdates(data.entries));
    }
  };

  useEffect(() => {
    if (!id) return;
    const fetchDetail = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getIncidentDetail(id);
        setDetail(response.incident);
        loadUpdates();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load incident details");
      } finally {
        setLoading(false);
      }
    };
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

  const { crisisEvent, contributingReports, nearbyResources } = detail;
  const mapCenter = crisisEvent.latitude && crisisEvent.longitude
    ? { lat: crisisEvent.latitude, lng: crisisEvent.longitude }
    : { lat: 23.8103, lng: 90.4125 };

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
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{crisisEvent.sitRepText}</p>
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

      {canUpdate && detail && (
        <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Update Crisis Status</h2>
            <button
              onClick={() => setShowUpdateForm(!showUpdateForm)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {showUpdateForm ? "Cancel" : "New Update"}
            </button>
          </div>
          {showUpdateForm && (
            <CrisisUpdateForm
              crisisEventId={crisisEvent.id}
              currentStatus={crisisEvent.status}
              onSubmit={() => {
                setShowUpdateForm(false);
                loadUpdates();
              }}
            />
          )}
          <div className="mt-4">
            <UpdateTimeline entries={updates} isAdmin={user?.role === "ADMIN"} />
          </div>
        </section>
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
    </div>
  );
}
