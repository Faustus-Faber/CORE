import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

import { getReportDetail } from "../services/api";
import { CredibilityWheel } from "../components/CredibilityWheel";
import {
  getTypeIconPath,
  severityBadgeClass,
  timeAgo,
  normalizeMediaUrl,
  isImageFile,
  isVideoFile
} from "../utils/incident";
import type { IncidentType, IncidentSeverity, IncidentStatus } from "../types";

const STATUS_LABEL: Record<IncidentStatus, string> = {
  PUBLISHED: "Published",
  UNDER_REVIEW: "Under Review"
};

function StatusBadge({ status }: { status: IncidentStatus }) {
  const className = status === "PUBLISHED"
    ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
    : "bg-amber-100 text-amber-800 ring-amber-300";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function MediaGallery({ files }: { files: string[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (files.length === 0) return null;

  return (
    <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
        Evidence ({files.length})
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((filePath, index) => {
          const mediaUrl = normalizeMediaUrl(filePath);
          if (!mediaUrl) return null;

          if (expandedIndex === index) {
            return (
              <div
                key={`${filePath}-${index}`}
                className="col-span-full flex flex-col items-center gap-2"
              >
                {isVideoFile(filePath) ? (
                  <video controls className="w-full max-w-2xl rounded-lg">
                    <source src={mediaUrl} />
                    Video not supported
                  </video>
                ) : (
                  <img
                    src={mediaUrl}
                    alt={`Evidence ${index + 1}`}
                    className="w-full max-w-2xl rounded-lg"
                  />
                )}
                <button
                  onClick={() => setExpandedIndex(null)}
                  className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:border-tide hover:text-tide"
                >
                  Close
                </button>
              </div>
            );
          }

          return (
            <button
              key={`${filePath}-${index}`}
              onClick={() => setExpandedIndex(index)}
              className="cursor-pointer overflow-hidden rounded-md ring-1 ring-slate-200 transition hover:ring-tide"
            >
              {isVideoFile(filePath) ? (
                <div className="flex h-32 w-full items-center justify-center bg-slate-900 text-center text-xs font-semibold text-white">
                  Open Video
                </div>
              ) : isImageFile(filePath) ? (
                <img
                  src={mediaUrl}
                  alt={`Evidence ${index + 1}`}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center bg-slate-100 text-xs font-medium text-slate-700">
                  Open File
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type ReportData = {
  id: string;
  reporterName: string;
  incidentTitle: string;
  classifiedIncidentTitle: string;
  incidentType: IncidentType;
  classifiedIncidentType: IncidentType;
  description: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  mediaFilenames: string[];
  credibilityScore: number;
  severityLevel: IncidentSeverity;
  status: IncidentStatus;
  spamFlagged: boolean;
  createdAt: string;
};

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
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
        const response = await getReportDetail(id);
        setReport(response.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report details");
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
        <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center ring-1 ring-red-200">
        <p className="text-sm font-semibold text-red-700">{error || "Report not found"}</p>
        <Link to="/reports/explore" className="mt-3 inline-block text-sm text-tide hover:underline">
          Back to Reports
        </Link>
      </div>
    );
  }

  const mapCenter = report.latitude && report.longitude
    ? { lat: report.latitude, lng: report.longitude }
    : { lat: 23.8103, lng: 90.4125 };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link to="/reports/explore" className="text-tide hover:underline">Reports</Link>
        <span>/</span>
        <span className="text-slate-400">{report.classifiedIncidentTitle || report.incidentTitle}</span>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
              <path d={getTypeIconPath(report.incidentType)} />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink">
                {report.classifiedIncidentTitle || report.incidentTitle}
              </h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityBadgeClass(report.severityLevel)}`}>
                {report.severityLevel}
              </span>
              <StatusBadge status={report.status} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {report.classifiedIncidentType.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {report.locationText}
              {report.latitude != null && report.longitude != null && (
                <span className="ml-2 text-xs text-slate-400">
                  ({report.latitude.toFixed(6)}, {report.longitude.toFixed(6)})
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Reported by {report.reporterName}</span>
              <span>Submitted {timeAgo(report.createdAt)}</span>
              {report.spamFlagged && (
                <span className="text-red-600 font-semibold">Flagged as Spam</span>
              )}
            </div>
          </div>
          <CredibilityWheel score={report.credibilityScore} size="lg" showLabel />
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Description
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{report.description}</p>
      </section>

      {isLoaded && report.latitude && report.longitude && (
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

      <MediaGallery files={report.mediaFilenames} />
    </div>
  );
}
