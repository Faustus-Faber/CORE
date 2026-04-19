import { useState } from "react";

import { CrisisUpdateEntry, dismissFlaggedUpdate } from "../services/api";
import { severityBadgeClass } from "../utils/incident";
import type { IncidentSeverity } from "../types";

type UpdateTimelineProps = {
  entries: CrisisUpdateEntry[];
  isAdmin?: boolean;
  onRefresh?: () => void;
};

export function UpdateTimeline({ entries, isAdmin, onRefresh }: UpdateTimelineProps) {
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className="text-center text-sm text-slate-500 py-6">No updates yet</p>;
  }

  const handleDismiss = async (entryId: string) => {
    setDismissingId(entryId);
    try {
      await dismissFlaggedUpdate(entryId);
      onRefresh?.();
    } catch {
      alert("Failed to dismiss flagged update");
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`rounded-lg border p-3 ${
            entry.isFlagged ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500">
                  {entry.updaterName}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                {entry.isFlagged && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    Conflicting Update
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-slate-600">
                  {entry.previousStatus.replace(/_/g, " ")}
                </span>
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-semibold text-blue-600">
                  {entry.newStatus.replace(/_/g, " ")}
                </span>
              </div>

              <p className="text-sm text-slate-700 mb-2">{entry.updateNote}</p>

              {entry.newSeverity && (
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(entry.newSeverity as IncidentSeverity)}`}>
                  {entry.newSeverity}
                </span>
              )}

              {entry.casualtyCount != null && entry.casualtyCount > 0 && (
                <span className="ml-2 text-xs text-red-600">
                  {entry.casualtyCount} casualties
                </span>
              )}

              {entry.displacedCount != null && entry.displacedCount > 0 && (
                <span className="ml-2 text-xs text-orange-600">
                  {entry.displacedCount} displaced
                </span>
              )}
            </div>

            {isAdmin && entry.isFlagged && (
              <button
                type="button"
                onClick={() => handleDismiss(entry.id)}
                disabled={dismissingId === entry.id}
                className="flex-shrink-0 rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {dismissingId === entry.id ? "Dismissing..." : "Dismiss"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
