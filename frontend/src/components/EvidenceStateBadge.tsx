/**
 * EvidenceStateBadge — displays a qualitative evidence-state badge
 * driven by the claims layer, NOT by an opaque AI score.
 *
 * Per refinement plan §10.6: "Do not display one magical 0–100 truth score.
 * Use understandable evidence states."
 *
 * This component takes an EvidenceState enum value that is derived from
 * the claim graph (source independence, corroboration, contradictions,
 * coordinator decisions) — not from a number.
 */

import type { EvidenceState } from "../types/evidence";

type EvidenceStateBadgeProps = {
  state: EvidenceState;
  size?: "sm" | "lg";
};

const STATE_STYLES: Record<EvidenceState, { bg: string; text: string; label: string }> = {
  CORROBORATED:           { bg: "bg-emerald-100", text: "text-emerald-700", label: "Corroborated" },
  OFFICIAL_CONFIRMED:     { bg: "bg-emerald-100", text: "text-emerald-700", label: "Official Confirmed" },
  COORDINATOR_VERIFIED:   { bg: "bg-teal-100",    text: "text-teal-700",    label: "Coordinator Verified" },
  PARTIALLY_CORROBORATED: { bg: "bg-blue-100",    text: "text-blue-700",    label: "Partially Corroborated" },
  SINGLE_SOURCE:          { bg: "bg-amber-100",   text: "text-amber-700",   label: "Single Source" },
  CONFLICTED:             { bg: "bg-red-100",     text: "text-red-700",     label: "Conflicted" },
  STALE:                  { bg: "bg-slate-200",   text: "text-slate-600",   label: "Stale" },
  REJECTED:               { bg: "bg-slate-200",   text: "text-slate-500",   label: "Rejected" },
};

export function EvidenceStateBadge({ state, size = "sm" }: EvidenceStateBadgeProps) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.SINGLE_SOURCE;
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${style.bg} ${style.text} ${sizeClass}`}>
      {style.label}
    </span>
  );
}
