import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { listCommunityReports, listMyReports } from "../services/api";
import type {
  EmergencyReportSummary,
  IncidentReportListItem,
  IncidentSeverity,
  IncidentType,
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

function severityColor(severity: IncidentSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-800 ring-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "LOW":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
}

function severityDotColor(severity: IncidentSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500";
    case "HIGH":
      return "bg-orange-500";
    case "MEDIUM":
      return "bg-amber-500";
    case "LOW":
      return "bg-emerald-500";
  }
}

function statusBadgeClass(status: "PUBLISHED" | "UNDER_REVIEW") {
  return status === "PUBLISHED"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
}

function credibilityStyle(score: number) {
  if (score >= 70) {
    return { stroke: "stroke-emerald-500", track: "stroke-emerald-100", text: "text-emerald-700" };
  }
  if (score >= 40) {
    return { stroke: "stroke-amber-500", track: "stroke-amber-100", text: "text-amber-700" };
  }
  return { stroke: "stroke-red-500", track: "stroke-red-100", text: "text-red-700" };
}

function MiniCredibilityWheel({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeScore / 100) * circumference;
  const style = credibilityStyle(safeScore);

  return (
    <div className="relative h-10 w-10 flex-shrink-0">
      <svg viewBox="0 0 48 48" className="h-10 w-10">
        <circle cx="24" cy="24" r={radius} strokeWidth="5" className={`fill-none ${style.track}`} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          strokeWidth="5"
          strokeLinecap="round"
          className={`fill-none ${style.stroke}`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${style.text}`}>{safeScore}</span>
      </div>
    </div>
  );
}

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

function normalizeMediaUrl(filePath: string) {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
  if (filePath.startsWith("/")) return `${API_ORIGIN}${filePath}`;
  return `${API_ORIGIN}/uploads/reports/${filePath}`;
}

function isImageFile(filePath: string) {
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(filePath);
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

function ReportCard({ report }: { report: IncidentReportListItem }) {
  const mediaThumb = report.mediaFilenames.length > 0 ? report.mediaFilenames[0] : null;
  const thumbUrl = mediaThumb ? normalizeMediaUrl(mediaThumb) : null;

  return (
    <article
      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-tide/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
            <path d={typeIcons[report.classifiedIncidentType] ?? typeIcons.OTHER} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink group-hover:text-tide">
              {report.classifiedIncidentTitle || report.incidentTitle}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severityColor(report.severityLevel)}`}>
              {report.severityLevel}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(report.status)}`}>
              {report.status === "PUBLISHED" ? "Published" : "Under Review"}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {report.description}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${severityDotColor(report.severityLevel)}`} />
              {report.locationText}
            </span>
            <span>{timeAgo(report.createdAt)}</span>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              {report.reporterName}
            </span>
            {report.mediaFilenames.length > 0 && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
                {report.mediaFilenames.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {thumbUrl && isImageFile(mediaThumb!) && (
            <img
              src={thumbUrl}
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
              loading="lazy"
            />
          )}
          <MiniCredibilityWheel score={report.credibilityScore} />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          to={`/reports/${report.id}`}
          className="rounded-md bg-tide/10 px-3 py-1.5 text-xs font-semibold text-tide transition hover:bg-tide hover:text-white"
        >
          View Details
        </Link>
      </div>
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
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
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
