import { FormEvent, useEffect, useState } from "react";

import {
  listAdminUnpublishedReports,
  updateReportStatusByAdmin
} from "../services/api";
import type {
  IncidentReportListItem,
  IncidentSeverity,
  ReportListQuery,
  ReportSortBy,
  SortOrder
} from "../types";

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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function AdminReportModerationPage() {
  const [reports, setReports] = useState<IncidentReportListItem[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReports = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await listAdminUnpublishedReports(appliedFilters);
      setReports(response.reports);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reports");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [appliedFilters]);

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

  const handlePublish = async (reportId: string) => {
    setError("");
    setMessage("");
    setIsUpdating(reportId);
    try {
      await updateReportStatusByAdmin(reportId, "PUBLISHED");
      setMessage("Report published successfully.");
      await loadReports();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Could not update report status"
      );
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-ink">Report Moderation</h1>
        <p className="mt-2 text-slate-700">
          Review unpublished incidents and publish valid reports to the community feed.
        </p>
      </section>

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <form onSubmit={handleApplyFilters} className="grid gap-3 md:grid-cols-4">
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
          <h2 className="text-xl font-bold text-ink">Unpublished Reports</h2>
          <p className="text-sm text-slate-600">{reports.length} pending</p>
        </div>

        {isLoading && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Loading unpublished reports...
          </p>
        )}

        {!isLoading && reports.length === 0 && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            No unpublished reports found.
          </p>
        )}

        {!isLoading && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
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
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    UNDER REVIEW
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

                <div className="mt-3">
                  <button
                    type="button"
                    disabled={isUpdating === report.id}
                    onClick={() => void handlePublish(report.id)}
                    className="rounded-md bg-moss px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isUpdating === report.id ? "Publishing..." : "Publish Report"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
