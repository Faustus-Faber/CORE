import { useEffect, useState } from "react";

import { getLeaderboardApi } from "../services/api";
import type { LeaderboardEntry } from "../types";

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getLeaderboardApi(period, 50)
      .then((data) => setEntries(data.entries))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [period]);

  const getRankMedal = (rank: number) => {
    if (rank === 1) return "🥇 ";
    if (rank === 2) return "🥈 ";
    if (rank === 3) return "🥉 ";
    return `#${rank} `;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink">Volunteer Leaderboard</h1>
          <p className="text-sm text-slate-500">
            Top contributors making a difference in the community.
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
              {p === "all" ? "All Time" : `This ${p}`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading leaderboard...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No volunteers found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Rank & Volunteer</th>
                  <th className="px-6 py-4 font-semibold">Total Points</th>
                  <th className="px-6 py-4 font-semibold">Verified Hours</th>
                  <th className="px-6 py-4 font-semibold mt-1">Badges & Trust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="transition hover:bg-slate-50/50"
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
                            />
                          ) : (
                            entry.fullName.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="font-semibold text-ink">{entry.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-tide">{entry.totalPoints} pts</span>
                        {/* Visual bar relative to top score */}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
