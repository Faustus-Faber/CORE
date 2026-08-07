import { useEffect, useState } from "react";
import { getClaimsForCrisis, decideClaimApi, type ClaimsResponse, type ClaimContradiction, type ClaimItem } from "../services/api";

interface ClaimsPanelProps {
  crisisEventId: string;
  isAdmin: boolean;
}

export function ClaimsPanel({ crisisEventId, isAdmin }: ClaimsPanelProps) {
  const [data, setData] = useState<ClaimsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetch = async () => {
    setLoading(true);
    try {
      const result = await getClaimsForCrisis(crisisEventId);
      setData(result);
    } catch (err: any) {
      setError(err.message ?? "Failed to load claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetch(); }, [crisisEventId]);

  const handleDecide = async (claimId: string, decision: "ACCEPT" | "REJECT") => {
    try {
      await decideClaimApi(claimId, decision, "Coordinator review");
      void fetch();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-4 text-sm text-slate-500">Loading claims...</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;
  if (!data || data.claims.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No claims extracted yet.</div>;
  }

  const stateColors: Record<string, string> = {
    SINGLE_SOURCE: "bg-slate-100 text-slate-700",
    PARTIALLY_CORROBORATED: "bg-blue-100 text-blue-700",
    CORROBORATED: "bg-green-100 text-green-700",
    CONFLICTED: "bg-red-100 text-red-700",
    COORDINATOR_VERIFIED: "bg-emerald-100 text-emerald-700",
    OFFICIAL_CONFIRMED: "bg-teal-100 text-teal-700",
    REJECTED: "bg-gray-100 text-gray-500",
    STALE: "bg-amber-100 text-amber-700"
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
          {data.summary.total} claims
        </span>
        {Object.entries(data.summary.byState).map(([state, count]: [string, number]) => (
          <span key={state} className={`rounded-full px-3 py-1 font-medium ${stateColors[state] ?? "bg-slate-100"}`}>
            {state.replace(/_/g, " ")}: {count}
          </span>
        ))}
      </div>

      {/* Contradictions */}
      {data.contradictions.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <h4 className="text-sm font-semibold text-red-800">⚠ Contradictions Detected</h4>
          <ul className="mt-2 space-y-1">
            {data.contradictions.map((c: ClaimContradiction, i: number) => (
              <li key={i} className="text-xs text-red-700">
                <strong>{c.fromClaim.subject}</strong>: "{c.fromClaim.value}" vs "{c.toClaim.value}"
                <span className="ml-2 text-red-400">— {c.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Claims list */}
      <div className="space-y-2">
        {data.claims.map((claim: ClaimItem) => (
          <div key={claim.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{claim.claimType}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${stateColors[claim.evidenceState] ?? "bg-slate-100"}`}>
                    {claim.evidenceState.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-ink">
                  <strong>{claim.subject}</strong>: {claim.value}
                  {claim.unit && <span className="text-slate-400"> {claim.unit}</span>}
                </p>
                {claim.sourceText && (
                  <p className="mt-1 text-xs italic text-slate-400">"{claim.sourceText}"</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Source: {claim.incidentReport?.incidentTitle ?? "Unknown"} · Supports: {claim.supportCount} · Conflicts: {claim.conflictCount}
                </p>
              </div>
              {isAdmin && claim.needsHumanDecision && (
                <div className="flex gap-1">
                  <button
                    onClick={() => void handleDecide(claim.id, "ACCEPT")}
                    className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => void handleDecide(claim.id, "REJECT")}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
