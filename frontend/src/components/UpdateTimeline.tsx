import { useState } from "react";

import { dismissFlaggedUpdate } from "../services/api";
import { severityBadgeClass } from "../utils/incident";
import type { CrisisUpdateEntry, IncidentSeverity } from "../types";

type UpdateTimelineProps = {
  entries: CrisisUpdateEntry[];
  isAdmin?: boolean;
  onRefresh?: () => void;
};

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const REVIEW_STATE_STYLE: Record<
  CrisisUpdateEntry["reviewState"],
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700"
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    className: "bg-amber-100 text-amber-700"
  },
  DISMISSED: {
    label: "Dismissed",
    className: "bg-slate-200 text-slate-700"
  }
};

const VERIFICATION_STYLE: Record<string, string> = {
  RESPONDER_CONFIRMED: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  ADMIN_CONFIRMED: "bg-violet-50 text-violet-700 ring-violet-200",
  SYSTEM_LOGGED: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function UpdateTimeline({
  entries,
  isAdmin,
  onRefresh
}: UpdateTimelineProps) {
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
        No command activity has been published for this incident yet.
      </p>
    );
  }

  const handleDismiss = async (entryId: string) => {
    setDismissingId(entryId);
    setError("");
    try {
      await dismissFlaggedUpdate(entryId);
      onRefresh?.();
    } catch (dismissError) {
      setError(
        dismissError instanceof Error
          ? dismissError.message
          : "Failed to dismiss command update"
      );
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {entries.map((entry) => {
        const reviewStyle = REVIEW_STATE_STYLE[entry.reviewState];
        const verificationStyle =
          VERIFICATION_STYLE[entry.verificationStatus] ??
          "bg-slate-100 text-slate-700 ring-slate-200";

        return (
          <article
            key={entry.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              entry.reviewState === "PENDING_REVIEW"
                ? "border-amber-300 bg-amber-50/70"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {entry.updaterName}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${reviewStyle.className}`}
                  >
                    {reviewStyle.label}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {formatLabel(entry.updateType)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${verificationStyle}`}
                  >
                    {formatLabel(entry.verificationStatus)}
                  </span>
                  {entry.newSeverity && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${severityBadgeClass(
                        entry.newSeverity as IncidentSeverity
                      )}`}
                    >
                      {entry.newSeverity}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                  <span>{formatLabel(entry.previousStatus)}</span>
                  <svg
                    className="h-3.5 w-3.5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span className="font-semibold text-tide">
                    {formatLabel(entry.newStatus)}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {entry.updateNote}
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {entry.accessStatus && (
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Access
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatLabel(entry.accessStatus)}
                      </p>
                    </div>
                  )}

                  {entry.affectedArea && (
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Area
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {entry.affectedArea}
                      </p>
                    </div>
                  )}

                  {(entry.casualtyCount != null || entry.displacedCount != null) && (
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Impact
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {entry.casualtyCount != null
                          ? `${entry.casualtyCount} casualties`
                          : "No casualty update"}
                        {entry.displacedCount != null
                          ? ` / ${entry.displacedCount} displaced`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>

                {entry.damageNotes && (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">Damage: </span>
                    {entry.damageNotes}
                  </p>
                )}

                {entry.resourceNeeds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.resourceNeeds.map((need) => (
                      <span
                        key={`${entry.id}-${need}`}
                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                      >
                        {need}
                      </span>
                    ))}
                  </div>
                )}

                {entry.closureChecklist && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      {
                        label: "Area Safe",
                        value: entry.closureChecklist.areaSafe
                      },
                      {
                        label: "People Accounted",
                        value: entry.closureChecklist.peopleAccounted
                      },
                      {
                        label: "Urgent Needs Stabilised",
                        value: entry.closureChecklist.urgentNeedsStabilized
                      }
                    ].map((item) => (
                      <div
                        key={`${entry.id}-${item.label}`}
                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                          item.value
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && entry.reviewState === "PENDING_REVIEW" && (
                <button
                  type="button"
                  onClick={() => void handleDismiss(entry.id)}
                  disabled={dismissingId === entry.id}
                  className="flex-shrink-0 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  {dismissingId === entry.id ? "Dismissing..." : "Dismiss"}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
