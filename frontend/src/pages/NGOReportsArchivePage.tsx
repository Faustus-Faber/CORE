import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listNGOReports, getDashboardFeed, NGOReport } from "../services/api";
import type { CrisisEventCard } from "../types";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "/api").replace("/api", "") || "";

function resolveReportUrl(report: NGOReport) {
  return `${API_ORIGIN}/api/ngo-reports/${report.id}/file`;
}

const GENERATABLE_STATUSES = new Set(["RESOLVED", "CLOSED"]);

export function NGOReportsArchivePage() {
  const [reports, setReports] = useState<NGOReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvedCrises, setResolvedCrises] = useState<CrisisEventCard[]>([]);
  const [showCrises, setShowCrises] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await listNGOReports();
      setReports(data);
    } catch (err) {
      setError("Failed to load NGO reports archive.");
    } finally {
      setLoading(false);
    }
  };

  const fetchResolvedCrises = async () => {
    try {
      const data = await getDashboardFeed({ sortBy: "mostRecent", sortOrder: "desc" });
      const filtered = (data.feed ?? []).filter((c) => GENERATABLE_STATUSES.has(c.status));
      setResolvedCrises(filtered);
      setShowCrises(true);
    } catch (err) {
      setError("Failed to load resolved crises.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      try {
        const data = await listNGOReports();
        if (!cancelled) setReports(data);
      } catch (err) {
        if (!cancelled) setError("Failed to load NGO reports archive.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void doFetch();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link to="/operations" className="text-tide hover:underline">Crisis Ops</Link>
        <span>/</span>
        <span className="text-slate-400">NGO Reports Archive</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">NGO Reports Archive</h1>
        <button
          type="button"
          onClick={() => void fetchResolvedCrises()}
          className="rounded-lg bg-tide px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tide/90 transition"
        >
          Generate New Report
        </button>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-700">
        <p className="flex items-center gap-2">
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
          <span>
            NGO Summary Reports are generated from the detail page of a <strong>Resolved</strong> or <strong>Closed</strong> crisis event. Click "Generate New Report" to see eligible crises.
          </span>
        </p>
      </div>

      {/* Resolved crises list for report generation */}
      {showCrises && (
        <div className="rounded-xl border border-tide/30 bg-white p-5 shadow-panel ring-1 ring-tide/20 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-ink">
              Resolved / Closed Crises ({resolvedCrises.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowCrises(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕ Close
            </button>
          </div>
          {resolvedCrises.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              No resolved or closed crises found. NGO reports can only be generated for crises in RESOLVED or CLOSED status.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {resolvedCrises.map((crisis) => (
                <div
                  key={crisis.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">
                      {crisis.classifiedIncidentTitle || crisis.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {crisis.locationText} · {crisis.status} · {new Date(crisis.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    to={`/dashboard/incidents/${crisis.id}`}
                    className="ml-3 flex-shrink-0 rounded-md bg-tide px-3 py-1.5 text-xs font-bold text-white transition hover:bg-tide/90"
                  >
                    Open & Generate
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generated reports archive */}
      <div className="rounded-xl bg-white shadow-panel ring-1 ring-slate-200 overflow-hidden">
        <h2 className="px-6 py-4 text-lg font-bold text-ink border-b border-slate-100">
          Generated Reports ({reports.length})
        </h2>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading reports...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No reports have been generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Report Title</th>
                  <th className="px-6 py-3">Crisis Event</th>
                  <th className="px-6 py-3">Generated By</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-ink">{report.title}</td>
                    <td className="px-6 py-4 text-slate-600">{report.crisisEvent?.title || "N/A"}</td>
                    <td className="px-6 py-4 text-slate-600">{report.generatedBy?.fullName || "Admin"}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(report.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <a
                          href={resolveReportUrl(report)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-tide hover:underline"
                        >
                          Preview
                        </a>
                        <a
                          href={resolveReportUrl(report)}
                          download
                          className="font-semibold text-tide hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
