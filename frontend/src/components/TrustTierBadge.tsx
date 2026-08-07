import type { TrustTier } from "../types";
import { TRUST_TIER_LABEL, TRUST_TIER_BADGE_CLASS, normalizeTrustTier } from "../utils/trustTier";

type TrustTierBadgeProps = {
  tier: string | null | undefined;
  size?: "sm" | "md";
};

export function TrustTierBadge({ tier, size = "sm" }: TrustTierBadgeProps) {
  const normalized = normalizeTrustTier(tier);
  const sizeClass = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ring-1 ${sizeClass} ${TRUST_TIER_BADGE_CLASS[normalized]}`}
    >
      {TRUST_TIER_LABEL[normalized]}
    </span>
  );
}
