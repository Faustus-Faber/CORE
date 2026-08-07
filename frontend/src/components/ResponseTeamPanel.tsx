import { useState } from "react";

import { TrustTierBadge } from "./TrustTierBadge";
import { normalizeTrustTier, TRUST_TIER_DOT_CLASS, TRUST_TIER_LABEL } from "../utils/trustTier";
import type { CrisisResponder, CrisisResponderStatus } from "../types";

const RESPONDER_STATUS_LABEL: Record<CrisisResponderStatus, string> = {
  RESPONDING: "Responding",
  EN_ROUTE: "En Route",
  ON_SITE: "On Site",
  COMPLETED: "Completed",
  UNAVAILABLE: "Unavailable"
};

const STATUS_DOT_CLASS: Record<CrisisResponderStatus, string> = {
  RESPONDING: "bg-slate-400",
  EN_ROUTE: "bg-blue-500",
  ON_SITE: "bg-emerald-500",
  COMPLETED: "bg-slate-300",
  UNAVAILABLE: "bg-red-400"
};

const NEXT_STATUSES: Record<CrisisResponderStatus, CrisisResponderStatus[]> = {
  RESPONDING: ["EN_ROUTE", "ON_SITE", "COMPLETED", "UNAVAILABLE"],
  EN_ROUTE: ["ON_SITE", "COMPLETED", "UNAVAILABLE"],
  ON_SITE: ["COMPLETED", "UNAVAILABLE"],
  COMPLETED: ["RESPONDING", "UNAVAILABLE"],
  UNAVAILABLE: ["RESPONDING"]
};

type ResponseTeamPanelProps = {
  responders: CrisisResponder[];
  myStatus: CrisisResponderStatus | null;
  myTrustTier: string | null | undefined;
  myObservationCount: number;
  myResourceNeedCount: number;
  crisisNeeds: string[];
  canOptIn: boolean;
  isUpdating: boolean;
  responderError: string;
  onStatusUpdate: (status: CrisisResponderStatus) => void;
};

export function ResponseTeamPanel({
  responders,
  myStatus,
  myTrustTier,
  myObservationCount,
  myResourceNeedCount,
  crisisNeeds,
  canOptIn,
  isUpdating,
  responderError,
  onStatusUpdate
}: ResponseTeamPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Count by tier
  const tierCounts = responders.reduce<Record<string, number>>((acc, r) => {
    const tier = normalizeTrustTier(r.trustTier);
    acc[tier] = (acc[tier] ?? 0) + 1;
    return acc;
  }, {});

  const activeResponders = responders.filter((r) => r.status !== "UNAVAILABLE");
  const nextStatuses: CrisisResponderStatus[] = myStatus
    ? NEXT_STATUSES[myStatus]
    : ["RESPONDING"];

  const myTier = normalizeTrustTier(myTrustTier);

  // Check if a skill matches any crisis need
  const skillMatchesNeed = (skills: string[]) => {
    if (!crisisNeeds.length) return [];
    const lowerNeeds = crisisNeeds.map((n) => n.toLowerCase());
    return skills.filter((s) => lowerNeeds.some((n) => s.toLowerCase().includes(n) || n.includes(s.toLowerCase())));
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Response Team
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {activeResponders.length} active / {responders.length} total
        </span>
      </div>

      {/* Team summary bar */}
      {responders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">Team:</span>
          {(["VETERAN", "RESPONDER", "TRAINEE", "REPORTER"] as const).map((tier) => {
            const count = tierCounts[tier] ?? 0;
            if (count === 0) return null;
            return (
              <span key={tier} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${TRUST_TIER_DOT_CLASS[tier]}`} />
                <span className="text-xs font-medium text-slate-700">
                  {count} {TRUST_TIER_LABEL[tier]}{count !== 1 ? "s" : ""}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Your status */}
      {canOptIn && (
        <div className={`rounded-lg border p-3 ${myTier === "TRAINEE" ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">Your status:</p>
            <TrustTierBadge tier={myTrustTier} />
            <span className="text-xs text-slate-600">
              {myStatus ? RESPONDER_STATUS_LABEL[myStatus] : "Not opted in"}
            </span>
          </div>

          {myStatus && (
            <p className="mt-1.5 text-xs text-slate-600">
              {myObservationCount} observation{myObservationCount !== 1 ? "s" : ""}, {myResourceNeedCount} resource need{myResourceNeedCount !== 1 ? "s" : ""}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                disabled={isUpdating}
                onClick={() => onStatusUpdate(status)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide disabled:opacity-60"
              >
                {isUpdating
                  ? "Updating..."
                  : status === "RESPONDING" && !myStatus
                    ? "Opt In to Respond"
                    : `Mark ${RESPONDER_STATUS_LABEL[status]}`}
              </button>
            ))}
          </div>

          {responderError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {responderError}
            </p>
          )}
        </div>
      )}

      {/* Responder cards */}
      {responders.length === 0 ? (
        <p className="text-sm text-slate-500">No volunteers have opted in for this crisis yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {responders.map((responder) => {
            const tier = normalizeTrustTier(responder.trustTier);
            const isTrainee = tier === "TRAINEE";
            const matchedSkills = skillMatchesNeed(responder.skills);
            const isExpanded = expandedId === responder.id;

            return (
              <article
                key={responder.id}
                className={`rounded-lg border p-3 transition ${
                  isTrainee
                    ? "border-blue-200 bg-blue-50/30"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{responder.volunteerName}</p>
                      <TrustTierBadge tier={responder.trustTier} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{responder.location || "Location unavailable"}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[responder.status]}`} />
                    <span className="text-[11px] font-semibold text-slate-600">
                      {RESPONDER_STATUS_LABEL[responder.status]}
                    </span>
                  </div>
                </div>

                {/* Contribution count */}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {responder.observationCount} obs
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    {responder.resourceNeedCount} needs
                  </span>
                </div>

                {/* Skills */}
                {responder.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {responder.skills.slice(0, 4).map((skill) => {
                      const isMatched = matchedSkills.includes(skill);
                      return (
                        <span
                          key={`${responder.id}-${skill}`}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isMatched
                              ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {skill}
                        </span>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : responder.id)}
                  className="mt-2 text-[11px] font-medium text-slate-500 hover:text-tide"
                >
                  {isExpanded ? "Hide details" : "Show details"}
                </button>

                {isExpanded && (
                  <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    <p>Opted in: {new Date(responder.optedInAt).toLocaleString()}</p>
                    <p>Last update: {new Date(responder.lastStatusAt).toLocaleString()}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
