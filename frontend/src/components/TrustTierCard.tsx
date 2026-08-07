import { useEffect, useState } from "react";

import { getTrustTierInfoApi, getVouchesReceivedApi } from "../services/api";
import { TrustTierBadge } from "./TrustTierBadge";
import {
  TRUST_TIER_LABEL,
  TRUST_TIER_DESCRIPTION,
  TRUST_TIER_DOT_CLASS,
  TRUST_TIER_ORDER,
  normalizeTrustTier,
  getTierLevel
} from "../utils/trustTier";
import type { TrustTierInfo, Vouch } from "../types";

// Promotion requirements for each tier — MUST match backend TIER_THRESHOLDS
const PROMOTION_REQUIREMENTS: Record<string, { points: number; observations: number; reports?: number; vouch?: boolean }> = {
  REPORTER: { points: 30, observations: 0, reports: 1 },    // 30 pts + 1 verified report (OR vouch)
  TRAINEE: { points: 100, observations: 3 },                 // 100 pts + 3 approved observations
  RESPONDER: { points: 500, observations: 10 },              // 500 pts + 10 approved observations
  VETERAN: { points: 0, observations: 0 },                   // max tier
};

export function TrustTierCard({ trustTier }: { trustTier: string | null | undefined }) {
  const [info, setInfo] = useState<TrustTierInfo | null>(null);
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTrustTierInfoApi(), getVouchesReceivedApi()])
      .then(([tierInfo, vouchRes]) => {
        if (cancelled) return;
        setInfo(tierInfo);
        setVouches(vouchRes.vouches ?? []);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="md:col-span-2 rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-200" />
      </section>
    );
  }

  const currentTier = normalizeTrustTier(info?.tier ?? trustTier);
  const currentLevel = getTierLevel(currentTier);
  const isMaxTier = currentTier === "VETERAN" || currentTier === "ADMIN";
  const nextTier = info?.nextTier;
  const reqs = nextTier ? PROMOTION_REQUIREMENTS[currentTier] : null;

  // Progress calculation
  const pointsProgress = reqs && info ? Math.min((info.points / reqs.points) * 100, 100) : 100;
  const obsProgress = reqs && info && reqs.observations > 0
    ? Math.min((info.approvedObservationCount / reqs.observations) * 100, 100)
    : 100;

  return (
    <section className="md:col-span-2 rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="h-6 w-6 text-tide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h2 className="text-2xl font-bold text-ink">Trust Tier</h2>
      </div>

      {/* Current tier card */}
      <div className={`rounded-xl border-2 p-5 ${
        currentTier === "VETERAN" ? "border-amber-300 bg-amber-50/50"
        : currentTier === "RESPONDER" ? "border-emerald-300 bg-emerald-50/50"
        : currentTier === "TRAINEE" ? "border-blue-300 bg-blue-50/50"
        : "border-slate-200 bg-slate-50"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${TRUST_TIER_DOT_CLASS[currentTier]}`} />
              <h3 className="text-xl font-bold text-ink">{TRUST_TIER_LABEL[currentTier]}</h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">{TRUST_TIER_DESCRIPTION[currentTier]}</p>
          </div>
          <TrustTierBadge tier={currentTier} size="md" />
        </div>

        {/* Tier ladder */}
        <div className="mt-4 flex items-center gap-1">
          {TRUST_TIER_ORDER.map((tier, i) => {
            const tierLevel = getTierLevel(tier);
            const isPassed = currentLevel >= tierLevel;
            const isCurrent = currentTier === tier;
            return (
              <div key={tier} className="flex items-center flex-1">
                <div className={`flex-1 h-1.5 rounded-full ${isPassed ? TRUST_TIER_DOT_CLASS[tier] : "bg-slate-200"}`} />
                <div className="flex flex-col items-center px-1">
                  <div className={`h-3 w-3 rounded-full ${isPassed ? TRUST_TIER_DOT_CLASS[tier] : "bg-slate-200"} ${isCurrent ? "ring-2 ring-offset-2 ring-slate-400" : ""}`} />
                  <span className={`mt-1 text-[10px] font-semibold ${isPassed ? "text-slate-700" : "text-slate-400"}`}>
                    {TRUST_TIER_LABEL[tier]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress to next tier */}
      {!isMaxTier && nextTier && reqs && info && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">
              Progress to {TRUST_TIER_LABEL[nextTier]}
            </h3>
            <TrustTierBadge tier={nextTier} />
          </div>

          {/* Points progress */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Points</span>
              <span className="text-slate-700">
                {info.points} / {reqs.points}
                {info.pointsNeeded ? ` (${info.pointsNeeded} to go)` : " ✓"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-tide transition-all"
                style={{ width: `${pointsProgress}%` }}
              />
            </div>
          </div>

          {/* Observations progress */}
          {reqs.observations > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Approved Observations</span>
                <span className="text-slate-700">
                  {info.approvedObservationCount} / {reqs.observations}
                  {info.observationsNeeded ? ` (${info.observationsNeeded} to go)` : " ✓"}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${obsProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Verified reports progress (REPORTER → TRAINEE) */}
          {reqs.reports != null && reqs.reports > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Verified Reports</span>
                <span className="text-slate-700">
                  {info.verifiedReportCount} / {reqs.reports}
                  {info.reportsNeeded ? ` (${info.reportsNeeded} to go)` : " ✓"}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (info.verifiedReportCount / reqs.reports) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Vouch alternative (REPORTER → TRAINEE: vouch bypasses points+reports) */}
          {currentTier === "REPORTER" && (
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Vouch from a Responder+ (alternative path)</span>
              <span className={`text-xs font-bold ${info.hasVouch ? "text-emerald-600" : "text-amber-600"}`}>
                {info.hasVouch ? "✓ Vouched" : "Optional"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats summary */}
      {info && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-ink">{info.points}</p>
            <p className="text-xs text-slate-500">Points</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-ink">{info.approvedObservationCount}</p>
            <p className="text-xs text-slate-500">Observations</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-ink">{info.verifiedReportCount}</p>
            <p className="text-xs text-slate-500">Reports</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-ink">{vouches.length}</p>
            <p className="text-xs text-slate-500">Vouches</p>
          </div>
        </div>
      )}

      {/* Vouches received */}
      {vouches.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-ink">Vouches Received</h3>
          {vouches.map((vouch) => (
            <div key={vouch.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{vouch.vouchedByName}</p>
                <p className="text-xs text-slate-600">{vouch.reason}</p>
                <p className="mt-1 text-[11px] text-slate-400">{new Date(vouch.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Earning pathway */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-ink">How to Earn Points</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg bg-white p-3 border border-slate-200">
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">+10</span>
            <div>
              <p className="text-xs font-semibold text-ink">Verified Incident Report</p>
              <p className="text-[11px] text-slate-500">Submit a report that gets published by admin</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-white p-3 border border-slate-200">
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">+5</span>
            <div>
              <p className="text-xs font-semibold text-ink">Verified Evidence Photo</p>
              <p className="text-[11px] text-slate-500">Upload evidence that gets verified by admin</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-white p-3 border border-slate-200">
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">+10</span>
            <div>
              <p className="text-xs font-semibold text-ink">Approved Field Observation</p>
              <p className="text-[11px] text-slate-500">Opt into a crisis, submit observations for admin review</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-white p-3 border border-slate-200">
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">+5</span>
            <div>
              <p className="text-xs font-semibold text-ink">Approved Resource Need</p>
              <p className="text-[11px] text-slate-500">Report resource needs during a crisis</p>
            </div>
          </div>
        </div>
        {currentTier === "REPORTER" && (
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-3">
            <p className="text-xs text-slate-700">
              <span className="font-bold">Tip:</span> Submit incident reports with evidence photos to earn points. Once you reach 30 points and have 1 verified report (or get vouched by a Responder+), you'll be promoted to Trainee and can opt into crises.
            </p>
          </div>
        )}
        {currentTier === "TRAINEE" && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-800">
              <span className="font-bold">Trainee tip:</span> Opt into active crises to submit field observations and resource needs. Your updates are reviewed by an admin before going live. Reach 100 points and 3 approved observations to become a Responder.
            </p>
          </div>
        )}
        {currentTier === "RESPONDER" && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800">
              <span className="font-bold">Responder tip:</span> Keep submitting approved field observations and earning points. Reach 500 points and 10 approved observations to become a Veteran. You can also vouch for other volunteers to help them advance.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
