/**
 * Evidence summary types — shared between frontend and backend.
 * These replace the opaque 0-100 credibility score with a
 * source-linked, contradiction-aware reasoning layer.
 */

export type EvidenceState =
  | "SINGLE_SOURCE"
  | "PARTIALLY_CORROBORATED"
  | "CORROBORATED"
  | "CONFLICTED"
  | "COORDINATOR_VERIFIED"
  | "OFFICIAL_CONFIRMED"
  | "REJECTED"
  | "STALE";

export type EvidenceFactor = {
  label: string;
  detail: string;
  polarity: "positive" | "negative" | "neutral";
};

export type EvidenceContradiction = {
  subject: string;
  claimType: string;
  valueA: string;
  valueB: string;
  reason: string;
};

export type EvidenceSummary = {
  dominantState: EvidenceState;
  stateLabel: string;
  independentSourceCount: number;
  supportingClaims: number;
  contradictingClaims: number;
  totalClaims: number;
  coordinatorVerified: boolean;
  officialConfirmed: boolean;
  lastUpdatedAt: string;
  freshnessHours: number;
  isStale: boolean;
  factors: EvidenceFactor[];
  contradictions: EvidenceContradiction[];
  internalDiagnosticScore: number | null;
};
