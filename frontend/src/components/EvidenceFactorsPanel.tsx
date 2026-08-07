/**
 * EvidenceFactorsPanel — shows the contributing factors behind an evidence state.
 *
 * Per refinement plan §10.6: "The interface should show contributing factors:
 * - number of independent sources
 * - location/time agreement
 * - responder or official confirmation
 * - media consistency
 * - contradictory sources
 * - freshness"
 *
 * This component renders the factors list and active contradictions
 * from the EvidenceSummary returned by the backend.
 */

import type { EvidenceSummary, EvidenceFactor } from "../types/evidence";
import { EvidenceStateBadge } from "./EvidenceStateBadge";

const POLARITY_STYLES: Record<EvidenceFactor["polarity"], { icon: string; color: string }> = {
  positive: { icon: "✓", color: "text-emerald-600" },
  negative: { icon: "⚠", color: "text-red-600" },
  neutral:  { icon: "•", color: "text-slate-400" },
};

function formatFreshness(hours: number): string {
  if (hours < 1) return "updated just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function EvidenceFactorsPanel({ summary }: { summary: EvidenceSummary | null | undefined }) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500">
          No structured claims have been extracted from this report yet.
          The evidence reasoning layer will activate once claims are processed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      {/* Header: dominant state + freshness */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EvidenceStateBadge state={summary.dominantState} size="lg" />
          {summary.isStale && (
            <span className="text-xs text-slate-400 italic">stale — no updates in 24h+</span>
          )}
        </div>
        <span className="text-xs text-slate-400">{formatFreshness(summary.freshnessHours)}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-lg font-bold text-slate-700">{summary.independentSourceCount}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sources</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-lg font-bold text-emerald-600">{summary.supportingClaims}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Supporting</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-lg font-bold text-red-600">{summary.contradictingClaims}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Conflicts</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-lg font-bold text-slate-700">{summary.totalClaims}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Claims</p>
        </div>
      </div>

      {/* Contributing factors */}
      {summary.factors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Contributing Factors
          </h4>
          <ul className="space-y-2">
            {summary.factors.map((factor, idx) => {
              const style = POLARITY_STYLES[factor.polarity];
              return (
                <li key={idx} className="flex items-start gap-2">
                  <span className={`text-sm font-bold ${style.color} flex-shrink-0`}>{style.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{factor.label}</p>
                    <p className="text-xs text-slate-500">{factor.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Active contradictions */}
      {summary.contradictions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
            Active Contradictions
          </h4>
          <div className="space-y-2">
            {summary.contradictions.map((c, idx) => (
              <div key={idx} className="rounded-md border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-semibold text-slate-700">
                  {c.claimType.replace(/_/g, " ").toLowerCase()} — {c.subject}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium text-red-700 bg-white px-2 py-0.5 rounded">
                    {c.valueA}
                  </span>
                  <span className="text-xs text-slate-400">vs</span>
                  <span className="text-xs font-medium text-red-700 bg-white px-2 py-0.5 rounded">
                    {c.valueB}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{c.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal diagnostic note */}
      <p className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2">
        Evidence state is derived from source independence, corroboration, and contradiction
        detection — not from an opaque AI score.
      </p>
    </div>
  );
}
