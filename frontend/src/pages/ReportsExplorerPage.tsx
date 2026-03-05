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

const defaultFilters: Required<ReportListQuery> = {
  search: "",
  severity: "ALL",
  sortBy: "createdAt",
  order: "desc"
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
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
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
      </div>

      <p className="mt-2 text-sm text-slate-700">{report.description}</p>

      <div className="mt-3 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
        <p>
          <span className="font-semibold">Reporter:</span> {report.reporterName}
        </p>
        <p>
          <span className="font-semibold">Location:</span> {report.locationText}
        </p>
        <p>
          <span className="font-semibold">Credibility:</span>{" "}
          {report.credibilityScore}
        </p>
        <p>
          <span className="font-semibold">Submitted:</span>{" "}
          {formatDate(report.createdAt)}
        </p>
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
      search: filters.search.trim()
    });
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

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
            onClick={() => setScope("community")}
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
            onClick={() => setScope("mine")}
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
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
