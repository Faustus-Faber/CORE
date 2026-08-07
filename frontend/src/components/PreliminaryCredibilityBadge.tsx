/**
 * PreliminaryCredibilityBadge — used in LIST views where fetching a full
 * evidence summary for every item would be too expensive.
 *
 * This is HONEST about what it shows: it labels the badge as "AI preliminary"
 * because it is derived from the AI classification score, NOT from the
 * claim-based evidence reasoning layer.
 *
 * Per refinement plan §10.6: "Any numeric model confidence can remain an
 * internal diagnostic and must not be labeled probability of truth unless
 * it has been calibrated on representative data."
 *
 * The full evidence state (SINGLE_SOURCE, CORROBORATED, CONFLICTED, etc.)
 * is shown on the DETAIL page via EvidenceFactorsPanel, which is driven
 * by the claims layer — not by this number.
 */

type PreliminaryCredibilityBadgeProps = {
  score: number;
  size?: "sm" | "lg";
};

const TIERS: Array<{ threshold: number; bg: string; text: string; label: string }> = [
  { threshold: 70, bg: "bg-emerald-100", text: "text-emerald-700", label: "AI: Likely Reliable" },
  { threshold: 50, bg: "bg-blue-100",    text: "text-blue-700",    label: "AI: Moderate" },
  { threshold: 30, bg: "bg-amber-100",   text: "text-amber-700",   label: "AI: Low Confidence" },
  { threshold: 0,  bg: "bg-red-100",     text: "text-red-700",     label: "AI: Very Low" },
];

export function PreliminaryCredibilityBadge({ score, size = "sm" }: PreliminaryCredibilityBadgeProps) {
  const tier = TIERS.find(t => score >= t.threshold) ?? TIERS[TIERS.length - 1];
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${tier.bg} ${tier.text} ${sizeClass}`}
      title="Preliminary AI classification score — not a truth rating. See Evidence & Reasoning panel for claim-based analysis."
    >
      {tier.label}
    </span>
  );
}
