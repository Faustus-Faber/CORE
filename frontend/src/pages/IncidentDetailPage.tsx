import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { getIncidentDetail } from "../services/api";
import type { IncidentDetailResponse, ContributingReport, IncidentSeverity, CrisisEventStatus, IncidentType } from "../types";

const severityColorMap: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-100 text-red-800 ring-red-300",
  HIGH: "bg-orange-100 text-orange-800 ring-orange-300",
  MEDIUM: "bg-amber-100 text-amber-800 ring-amber-300",
  LOW: "bg-emerald-100 text-emerald-800 ring-emerald-300"
};

const statusLabel: Record<CrisisEventStatus, string> = {
  ACTIVE: "Active",
  CONTAINED: "Contained",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

const typeIcons: Record<IncidentType, string> = {
  FLOOD: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  FIRE: "M12 23c-3.6 0-8-2.4-8-7.7 0-3.5 2.3-6.3 4.1-8.2.8-.9 1.5-1.6 1.9-2.3.4.7 1.1 1.4 1.9 2.3C13.7 9 16 11.8 16 15.3 16 20.6 15.6 23 12 23zm0-17.4c-.3.4-.7.8-1.1 1.3C9.3 8.6 7.3 11 7.3 15.3 7.3 19 10.2 20.7 12 20.7s4.7-1.7 4.7-5.4c0-4.3-2-6.7-3.6-8.4-.4-.5-.8-.9-1.1-1.3z",
  EARTHQUAKE: "M2 18h2v2H2v-2zm4 0h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM4 12l2 3h12l2-3H4zm16-6H4l-2 4h20l-2-4z",
  BUILDING_COLLAPSE: "M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z",
  ROAD_ACCIDENT: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
  VIOLENCE: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  MEDICAL_EMERGENCY: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z",
  OTHER: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

function normalizeMediaUrl(filePath: string) {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
  if (filePath.startsWith("/")) return `${API_ORIGIN}${filePath}`;
  return `${API_ORIGIN}/uploads/reports/${filePath}`;
}

function isImageFile(filePath: string) {
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(filePath);
}

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
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${severityColorMap[report.severityLevel]}`}>
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
                    <img src={mediaUrl} alt="" loading="lazy" className="h-24 w-full object-cover" />
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
  const [detail, setDetail] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
  });

  useEffect(() => {
    if (!id) return;
    const fetchDetail = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getIncidentDetail(id);
        setDetail(response.incident);
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
          ← Back to Dashboard
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
              <path d={typeIcons[crisisEvent.incidentType] ?? typeIcons.OTHER} />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink">{crisisEvent.title}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityColorMap[crisisEvent.severityLevel]}`}>
                {crisisEvent.severityLevel}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {statusLabel[crisisEvent.status]}
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