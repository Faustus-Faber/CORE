import { useEffect, useMemo, useState } from "react";

import { getLeaderboardApi } from "../services/api";
import { TrustTierBadge } from "../components/TrustTierBadge";
import { normalizeTrustTier, TRUST_TIER_DOT_CLASS, TRUST_TIER_LABEL } from "../utils/trustTier";
import type { LeaderboardEntry, TrustTier } from "../types";

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [tierFilter, setTierFilter] = useState<TrustTier | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    getLeaderboardApi(period, 50)
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [period]);

  // Tier distribution
  const tierDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    entries.forEach((e) => {
      const tier = normalizeTrustTier(e.trustTier);
      dist[tier] = (dist[tier] ?? 0) + 1;
    });
    return dist;
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (tierFilter === "ALL") return entries;
    return entries.filter((e) => normalizeTrustTier(e.trustTier) === tierFilter);
  }, [entries, tierFilter]);

  const getRankMedal = (rank: number) => {
    if (rank === 1) return "🥇 ";
    if (rank === 2) return "🥈 ";
    if (rank === 3) return "🥉 ";
    return `#${rank} `;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink">Community Impact Board</h1>
          <p className="text-sm text-slate-500">
            Recognizing the volunteers who make a difference.
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["all", "month", "week"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                period === p ? "bg-tide text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p === "all" ? "All Time" : p === "month" ? "This Month" : "This Week"}
            </button>
          ))}
        </div>
      </div>

      {/* Tier distribution summary */}
      {!isLoading && !error && entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-panel ring-1 ring-slate-200">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Community:</span>
          {(["VETERAN", "RESPONDER", "TRAINEE", "REPORTER"] as const).map((tier) => {
            const count = tierDistribution[tier] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={tier}
                onClick={() => setTierFilter(tierFilter === tier ? "ALL" : tier)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tierFilter === tier
                    ? "bg-tide text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${TRUST_TIER_DOT_CLASS[tier]}`} />
                {count} {TRUST_TIER_LABEL[tier]}{count !== 1 ? "s" : ""}
              </button>
            );
          })}
          {tierFilter !== "ALL" && (
            <button
              onClick={() => setTierFilter("ALL")}
              className="text-xs font-medium text-slate-500 hover:text-tide"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading impact board...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {entries.length === 0 ? "No volunteers found for this period." : "No volunteers match this tier filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Rank & Volunteer</th>
                  <th className="px-6 py-4 font-semibold">Trust Tier</th>
                  <th className="px-6 py-4 font-semibold">Impact Points</th>
                  <th className="px-6 py-4 font-semibold">Hours</th>
                  <th className="px-6 py-4 font-semibold">Badges & Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const tier = normalizeTrustTier(entry.trustTier);
                  return (
                    <tr
                      key={entry.id}
                      className={`transition hover:bg-slate-50/50 ${
                        entry.rank <= 3 ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-center text-base font-bold text-slate-400">
                            {getRankMedal(entry.rank)}
                          </span>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tide/10 font-bold text-tide">
                            {entry.avatarUrl ? (
                              <img
                                src={entry.avatarUrl}
                                alt={entry.fullName}
                                className="h-full w-full rounded-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              entry.fullName.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className="font-semibold text-ink">{entry.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TrustTierBadge tier={entry.trustTier} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-tide">{entry.totalPoints} pts</span>
                          <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-tide rounded-full"
                              style={{
                                width: `${Math.max(5, (entry.totalPoints / Math.max(1, entries[0].totalPoints)) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {entry.totalVerifiedHours} hrs
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium">{entry.badgeCount} Badges</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <svg className="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {entry.avgRating ? `${entry.avgRating} (${entry.reviewCount})` : "No ratings"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
