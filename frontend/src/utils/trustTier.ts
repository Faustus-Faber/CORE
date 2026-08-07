import type { TrustTier } from "../types";

export const TRUST_TIER_LABEL: Record<TrustTier, string> = {
  REPORTER: "Reporter",
  TRAINEE: "Trainee",
  RESPONDER: "Responder",
  VETERAN: "Veteran",
  ADMIN: "Admin",
};

export const TRUST_TIER_DESCRIPTION: Record<TrustTier, string> = {
  REPORTER: "Submit reports, evidence, and tasks with photo proof",
  TRAINEE: "Opt into crises and submit field observations",
  RESPONDER: "Full update powers, can vouch for others",
  VETERAN: "Trusted community member with full privileges",
  ADMIN: "System administrator with full access",
};

export const TRUST_TIER_BADGE_CLASS: Record<TrustTier, string> = {
  REPORTER: "bg-slate-100 text-slate-600 ring-slate-200",
  TRAINEE: "bg-blue-50 text-blue-700 ring-blue-200",
  RESPONDER: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  VETERAN: "bg-amber-50 text-amber-700 ring-amber-200",
  ADMIN: "bg-violet-50 text-violet-700 ring-violet-200",
};

export const TRUST_TIER_DOT_CLASS: Record<TrustTier, string> = {
  REPORTER: "bg-slate-400",
  TRAINEE: "bg-blue-500",
  RESPONDER: "bg-emerald-500",
  VETERAN: "bg-amber-500",
  ADMIN: "bg-violet-500",
};

export const TRUST_TIER_ORDER: TrustTier[] = ["REPORTER", "TRAINEE", "RESPONDER", "VETERAN"];

export function normalizeTrustTier(value: string | null | undefined): TrustTier {
  if (!value) return "REPORTER";
  if (value === "ADMIN") return "ADMIN";
  if (["REPORTER", "TRAINEE", "RESPONDER", "VETERAN"].includes(value)) {
    return value as TrustTier;
  }
  return "REPORTER";
}

export function getTierLevel(tier: TrustTier): number {
  switch (tier) {
    case "REPORTER": return 0;
    case "TRAINEE": return 1;
    case "RESPONDER": return 2;
    case "VETERAN": return 3;
    case "ADMIN": return 4;
  }
}
