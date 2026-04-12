import { INCIDENT_TYPE_OPTIONS, SEVERITY_OPTIONS } from "../utils/incident";
import type { IncidentType, IncidentSeverity, DashboardSortBy, DashboardFeedFilters, DashboardTimeRange } from "../types";

type DashboardFiltersProps = {
  filters: DashboardFeedFilters;
  onChange: (filters: DashboardFeedFilters) => void;
};

const TYPE_FILTER_OPTIONS: Array<{ value: IncidentType | "ALL"; label: string }> = [
  { value: "ALL", label: "All Types" },
  ...INCIDENT_TYPE_OPTIONS
];

const TIME_RANGE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "All" },
  { value: 1, label: "1h" },
  { value: 6, label: "6h" },
  { value: 24, label: "24h" },
  { value: 168, label: "7d" }
];

const SORT_OPTIONS: Array<{ value: DashboardSortBy; label: string }> = [
  { value: "mostRecent", label: "Most Recent" },
  { value: "highestSeverity", label: "Highest Severity" },
  { value: "mostReports", label: "Most Reports" }
];

export function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-panel ring-1 ring-slate-200">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label htmlFor="filter-type" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Type</label>
          <select
            id="filter-type"
            value={filters.incidentType}
            onChange={(e) => onChange({ ...filters, incidentType: e.target.value as IncidentType | "ALL" })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
          >
            {TYPE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-severity" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</label>
          <select
            id="filter-severity"
            value={filters.severity}
            onChange={(e) => onChange({ ...filters, severity: e.target.value as IncidentSeverity | "ALL" })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-sort" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Sort</label>
          <select
            id="filter-sort"
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as DashboardSortBy })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Time Range</p>
        <div className="flex flex-wrap items-center gap-2">
          {TIME_RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ ...filters, timeRange: o.value as DashboardTimeRange })}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filters.timeRange === o.value
                  ? "bg-tide text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {o.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
            >
              {filters.sortOrder === "asc" ? "\u2191 Ascending" : "\u2193 Descending"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
