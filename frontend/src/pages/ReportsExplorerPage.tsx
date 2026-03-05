import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { listCommunityReports, listMyReports } from "../services/api";
import type {
  EmergencyReportSummary,
  IncidentReportListItem,
  IncidentSeverity,
  ReportListQuery,
  ReportSortBy,
  SortOrder
} from "../types";

type ReportScope = "community" | "mine";

type SubmissionState = {
  justSubmitted?: boolean;
  message?: string;
  report?: EmergencyReportSummary;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

const defaultFilters: Required<ReportListQuery> = {
  search: "",
  severity: "ALL",
  sortBy: "createdAt",
  order: "desc",
  page: 1,
  limit: 8
};

const severityOptions: Array<{ value: IncidentSeverity | "ALL"; label: string }> = [
  { value: "ALL", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" }
];

const sortByOptions: Array<{ value: ReportSortBy; label: string }> = [
  { value: "createdAt", label: "Newest / Oldest" },
  { value: "severity", label: "Severity" },
  { value: "credibility", label: "Credibility" }
];

const orderOptions: Array<{ value: SortOrder; label: string }> = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" }
];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function severityBadgeClass(severity: IncidentSeverity) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "MEDIUM":
      return "bg-amber-100 text-amber-800";
    case "LOW":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusBadgeClass(status: "PUBLISHED" | "UNDER_REVIEW") {
  return status === "PUBLISHED"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
}

function credibilityStyle(score: number) {
  if (score >= 70) {
    return {
      stroke: "stroke-emerald-500",
      track: "stroke-emerald-100",
      text: "text-emerald-700",
      label: "Reliable"
    };
  }

  if (score >= 40) {
    return {
      stroke: "stroke-amber-500",
      track: "stroke-amber-100",
      text: "text-amber-700",
      label: "Needs Verification"
    };
  }

  return {
    stroke: "stroke-red-500",
    track: "stroke-red-100",
    text: "text-red-700",
    label: "Low Confidence"
  };
}

function normalizeMediaUrl(filePath: string) {
  if (!filePath) {
    return "";
  }

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  if (filePath.startsWith("/")) {
    return `${API_ORIGIN}${filePath}`;
  }

  return `${API_ORIGIN}/uploads/reports/${filePath}`;
}

function isImageFile(filePath: string) {
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(filePath);
}

function isVideoFile(filePath: string) {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(filePath);
}

function CredibilityWheel({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeScore / 100) * circumference;
  const style = credibilityStyle(safeScore);

  return (
    <div className="flex min-w-[112px] flex-col items-center justify-center rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 88 88" className="h-20 w-20">
          <circle
            cx="44"
            cy="44"
            r={radius}
            strokeWidth="8"
            className={`fill-none ${style.track}`}
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            strokeWidth="8"
            strokeLinecap="round"
            className={`fill-none ${style.stroke}`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-base font-bold ${style.text}`}>{safeScore}</span>
        </div>
      </div>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Credibility
      </p>
      <p className={`text-[11px] font-semibold ${style.text}`}>{style.label}</p>
    </div>
  );
}

function SummaryBanner({ summary }: { summary: SubmissionState | null }) {
  if (!summary?.justSubmitted || !summary.report) {
    return null;
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-emerald-200">
      <h2 className="text-xl font-bold text-ink">
        Report Submitted Successfully
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        {summary.message ?? "Your report was saved and analyzed."}
      </p>
      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        <p>
          <span className="font-semibold">Classified Title:</span>{" "}
          {summary.report.classifiedIncidentTitle}
        </p>
        <p>
          <span className="font-semibold">Severity:</span>{" "}
          {summary.report.severityLevel}
        </p>
        <p>
          <span className="font-semibold">Credibility:</span>{" "}
          {summary.report.credibilityScore}
        </p>
        <p>
          <span className="font-semibold">Status:</span> {summary.report.status}
        </p>
      </div>
    </section>
  );
}

function ReportCard({
  report,
  evidenceExpanded,
  onToggleEvidence
}: {
  report: IncidentReportListItem;
  evidenceExpanded: boolean;
  onToggleEvidence: (reportId: string) => void;
}) {
  const mediaItems = (report.mediaFilenames ?? []).filter(Boolean);
  const previewItems = evidenceExpanded ? mediaItems : mediaItems.slice(0, 3);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">
              {report.classifiedIncidentTitle || report.incidentTitle}
            </h3>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${severityBadgeClass(
                report.severityLevel
              )}`}
            >
              {report.severityLevel}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                report.status
              )}`}
            >
              {report.status === "PUBLISHED" ? "Published" : "Under Review"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {report.classifiedIncidentType.replaceAll("_", " ")}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {report.description}
          </p>

          <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <p>
              <span className="font-semibold">Reporter:</span> {report.reporterName}
            </p>
            <p>
              <span className="font-semibold">Location:</span> {report.locationText}
            </p>
            <p>
              <span className="font-semibold">Type:</span>{" "}
              {report.incidentType.replaceAll("_", " ")}
            </p>
            <p>
              <span className="font-semibold">Submitted:</span>{" "}
              {formatDate(report.createdAt)}
            </p>
          </div>
        </div>

        <CredibilityWheel score={report.credibilityScore} />
      </div>

      {mediaItems.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidence ({mediaItems.length})
            </p>
            <button
              type="button"
              onClick={() => onToggleEvidence(report.id)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-tide hover:text-tide"
            >
              {evidenceExpanded ? "Hide Evidence" : "Show Evidence"}
            </button>
          </div>

          {!evidenceExpanded && (
            <p className="mb-2 text-xs text-slate-500">
              Evidence is collapsed for faster browsing.
            </p>
          )}

          {evidenceExpanded && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {previewItems.map((mediaPath, index) => {
              const mediaUrl = normalizeMediaUrl(mediaPath);

              if (!mediaUrl) {
                return null;
              }

              return (
                <a
                  key={`${report.id}-${mediaPath}-${index}`}
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-md ring-1 ring-slate-200 transition hover:ring-tide"
                >
                  {isVideoFile(mediaPath) ? (
                    <div className="flex h-28 w-full items-center justify-center bg-slate-900 px-2 text-center text-xs font-semibold text-white">
                      Open Video Attachment
                    </div>
                  ) : isImageFile(mediaPath) ? (
                    <img
                      src={mediaUrl}
                      alt={`Report evidence ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-slate-100 px-2 text-xs font-medium text-slate-700">
                      Open Attachment
                    </div>
                  )}
                </a>
              );
            })}
          </div>
          )}

          {!evidenceExpanded && mediaItems.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {previewItems.map((mediaPath, index) => {
                const mediaUrl = normalizeMediaUrl(mediaPath);
                if (!mediaUrl) {
                  return null;
                }

                return (
                  <a
                    key={`${report.id}-collapsed-${mediaPath}-${index}`}
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-16 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    {isVideoFile(mediaPath)
                      ? "Video Attachment"
                      : isImageFile(mediaPath)
                        ? "Image Attachment"
                        : "File Attachment"}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function ReportsExplorerPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const initialScope: ReportScope =
    searchParams.get("view") === "mine" ? "mine" : "community";

  const submissionState = useMemo(() => {
    const state = location.state as SubmissionState | null;
    return state ?? null;
  }, [location.state]);

  const [scope, setScope] = useState<ReportScope>(initialScope);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [reports, setReports] = useState<IncidentReportListItem[]>([]);
  const [expandedEvidenceByReport, setExpandedEvidenceByReport] = useState<
    Record<string, boolean>
  >({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response =
          scope === "community"
            ? await listCommunityReports(appliedFilters)
            : await listMyReports(appliedFilters);

        setReports(response.reports);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load reports"
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchReports();
  }, [appliedFilters, scope]);

  const handleApplyFilters = (event: FormEvent) => {
    event.preventDefault();
    setAppliedFilters({
      ...filters,
      search: filters.search.trim(),
      page: 1
    });
    setExpandedEvidenceByReport({});
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setExpandedEvidenceByReport({});
  };

  const switchScope = (nextScope: ReportScope) => {
    setScope(nextScope);
    setFilters((previous) => ({
      ...previous,
      page: 1
    }));
    setAppliedFilters((previous) => ({
      ...previous,
      page: 1
    }));
    setExpandedEvidenceByReport({});
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || isLoading) {
      return;
    }

    setFilters((previous) => ({
      ...previous,
      page: nextPage
    }));
    setAppliedFilters((previous) => ({
      ...previous,
      page: nextPage
    }));
    setExpandedEvidenceByReport({});
  };

  const handleToggleEvidence = (reportId: string) => {
    setExpandedEvidenceByReport((previous) => ({
      ...previous,
      [reportId]: !previous[reportId]
    }));
  };

  const currentPage = appliedFilters.page;
  const hasNextPage = reports.length === appliedFilters.limit;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-ink">Reports Explorer</h1>
        <p className="mt-2 text-slate-700">
          Search and prioritize emergency reports by severity, credibility, and
          timeline.
        </p>
      </section>

      <SummaryBanner summary={submissionState} />

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchScope("community")}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              scope === "community"
                ? "bg-tide text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Community Reports
          </button>
          <button
            type="button"
            onClick={() => switchScope("mine")}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              scope === "mine" ? "bg-tide text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            My Submissions
          </button>
          <Link
            to="/report-incident"
            className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white"
          >
            Submit New Report
          </Link>
        </div>

        <form onSubmit={handleApplyFilters} className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm font-medium md:col-span-2">
            Search
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  search: event.target.value
                }))
              }
              placeholder="Title, location, or description"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm font-medium">
            Severity
            <select
              value={filters.severity}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  severity: event.target.value as Required<ReportListQuery>["severity"]
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {severityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm font-medium">
              Sort By
              <select
                value={filters.sortBy}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    sortBy: event.target.value as ReportSortBy
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {sortByOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Order
              <select
                value={filters.order}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    order: event.target.value as SortOrder
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {orderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="md:col-span-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">
            {scope === "community" ? "Community Reports" : "My Submissions"}
          </h2>
          <p className="text-sm text-slate-600">{reports.length} result(s)</p>
        </div>

        {isLoading && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Loading reports...
          </p>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!isLoading && !error && reports.length === 0 && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            No reports match the current filters.
          </p>
        )}

        {!isLoading && !error && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                evidenceExpanded={Boolean(expandedEvidenceByReport[report.id])}
                onToggleEvidence={handleToggleEvidence}
              />
            ))}
          </div>
        )}

        {!error && (
          <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
            <p className="text-slate-600">Page {currentPage}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage || isLoading}
                className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
