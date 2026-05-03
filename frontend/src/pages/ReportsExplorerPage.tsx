import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { listCommunityReports, listMyReports } from "../services/api";
import { CredibilityWheel } from "../components/CredibilityWheel";
import {
  getTypeIconPath,
  severityBadgeClass,
  severityDotClass,
  timeAgo,
  normalizeMediaUrl,
  isImageFile,
  SEVERITY_OPTIONS
} from "../utils/incident";
import type {
  EmergencyReportSummary,
  IncidentReportListItem,
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

const DEFAULT_FILTERS: Required<ReportListQuery> = {
  search: "",
  severity: "ALL",
  sortBy: "createdAt",
  order: "desc",
  page: 1,
  limit: 8
};

const SORT_BY_OPTIONS: Array<{ value: ReportSortBy; label: string }> = [
  { value: "createdAt", label: "Newest / Oldest" },
  { value: "severity", label: "Severity" },
  { value: "credibility", label: "Credibility" }
];

const ORDER_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" }
];

function statusBadgeClass(status: "PUBLISHED" | "UNDER_REVIEW") {
  return status === "PUBLISHED"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
}

function SummaryBanner({ summary }: { summary: SubmissionState | null }) {
  if (!summary?.justSubmitted || !summary.report) return null;

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
    <article className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-tide/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
            <path d={getTypeIconPath(report.classifiedIncidentType)} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink group-hover:text-tide">
              {report.classifiedIncidentTitle || report.incidentTitle}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severityBadgeClass(report.severityLevel)}`}>
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
              <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(report.severityLevel)}`} />
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
          <CredibilityWheel score={report.credibilityScore} />
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
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
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
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const switchScope = (nextScope: ReportScope) => {
    setScope(nextScope);
    setFilters((previous) => ({ ...previous, page: 1 }));
    setAppliedFilters((previous) => ({ ...previous, page: 1 }));
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || isLoading) return;
    setFilters((previous) => ({ ...previous, page: nextPage }));
    setAppliedFilters((previous) => ({ ...previous, page: nextPage }));
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
                setFilters((previous) => ({ ...previous, search: event.target.value }))
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
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
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
                {SORT_BY_OPTIONS.map((option) => (
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
                {ORDER_OPTIONS.map((option) => (
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
              <ReportCard key={report.id} report={report} />
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
