import { useState } from "react";

import { submitCrisisUpdate } from "../services/api";
import { UpdateTimeline } from "./UpdateTimeline";
import { severityBadgeClass } from "../utils/incident";
import { normalizeTrustTier, TRUST_TIER_LABEL } from "../utils/trustTier";
import type {
  CrisisAccessStatus,
  CrisisCommandCenter,
  CrisisEventStatus,
  CrisisUpdateEntry,
  CrisisUpdateInput,
  CrisisUpdateType,
  IncidentSeverity
} from "../types";

// ── Labels ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  VERIFIED: "Verified",
  UNDER_INVESTIGATION: "Under Investigation",
  RESPONSE_IN_PROGRESS: "Response in Progress",
  CONTAINED: "Contained",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

const ACCESS_STATUS_LABEL: Record<CrisisAccessStatus, string> = {
  OPEN: "Open",
  LIMITED: "Limited",
  BLOCKED: "Blocked",
  UNKNOWN: "Unknown"
};

const UPDATE_TYPE_LABEL: Record<CrisisUpdateType, string> = {
  STATUS_CHANGE: "Status Change",
  FIELD_OBSERVATION: "Field Observation",
  ACCESS_UPDATE: "Access Update",
  IMPACT_UPDATE: "Impact Update",
  RESOURCE_NEED: "Resource Need",
  CLOSURE_NOTE: "Closure Note",
  ADMIN_CORRECTION: "Admin Correction",
  RESPONDER_STATUS: "Responder Status"
};

const STATUS_ORDER: CrisisEventStatus[] = [
  "REPORTED", "VERIFIED", "UNDER_INVESTIGATION", "RESPONSE_IN_PROGRESS",
  "CONTAINED", "RESOLVED", "CLOSED"
];

// ── Quick composer types ────────────────────────────────────────────────────

type QuickAction = {
  type: Exclude<CrisisUpdateType, "RESPONDER_STATUS">;
  label: string;
  icon: string;
  minTier: "TRAINEE" | "RESPONDER" | "ADMIN";
};

const QUICK_ACTIONS: QuickAction[] = [
  { type: "FIELD_OBSERVATION", label: "Report Observation", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", minTier: "TRAINEE" },
  { type: "RESOURCE_NEED", label: "Request Resource", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", minTier: "TRAINEE" },
  { type: "STATUS_CHANGE", label: "Update Status", icon: "M13 10V3L4 14h7v7l9-11h-7z", minTier: "RESPONDER" },
  { type: "ACCESS_UPDATE", label: "Access Update", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7", minTier: "RESPONDER" },
  { type: "IMPACT_UPDATE", label: "Impact Update", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", minTier: "RESPONDER" },
  { type: "CLOSURE_NOTE", label: "Closure Note", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", minTier: "ADMIN" },
  { type: "ADMIN_CORRECTION", label: "Admin Correction", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", minTier: "ADMIN" },
];

const TIER_LEVEL: Record<string, number> = {
  REPORTER: 0, TRAINEE: 1, RESPONDER: 2, VETERAN: 3, ADMIN: 4
};

// ── Props ───────────────────────────────────────────────────────────────────

type CrisisActivityPanelProps = {
  crisisEventId: string;
  crisisStatus: CrisisEventStatus;
  crisisSeverity: IncidentSeverity;
  commandCenter: CrisisCommandCenter;
  updates: CrisisUpdateEntry[];
  isAdmin: boolean;
  userTrustTier: string | null | undefined;
  canSubmitCommand: boolean;
  canOpenCommandPanel: boolean;
  onRefresh: () => void;
};

type Tab = "overview" | "feed" | "needs";
type ComposerType = Exclude<CrisisUpdateType, "RESPONDER_STATUS"> | null;

// ── Component ───────────────────────────────────────────────────────────────

export function CrisisActivityPanel({
  crisisEventId,
  crisisStatus,
  crisisSeverity,
  commandCenter,
  updates,
  isAdmin,
  userTrustTier,
  canSubmitCommand,
  canOpenCommandPanel,
  onRefresh
}: CrisisActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [composerType, setComposerType] = useState<ComposerType>(null);
  const [feedFilter, setFeedFilter] = useState<CrisisUpdateType | "ALL">("ALL");

  const userTier = isAdmin ? "ADMIN" : normalizeTrustTier(userTrustTier);
  const userTierLevel = TIER_LEVEL[userTier] ?? 0;

  // Available quick actions based on tier
  const availableActions = QUICK_ACTIONS.filter((action) => {
    if (action.minTier === "ADMIN") return isAdmin;
    return userTierLevel >= TIER_LEVEL[action.minTier];
  });

  // Filter updates for feed
  const filteredUpdates = feedFilter === "ALL"
    ? updates
    : updates.filter((u) => u.updateType === feedFilter);

  // Extract resource needs from updates
  const resourceNeedUpdates = updates.filter(
    (u) => u.updateType === "RESOURCE_NEED" && u.reviewState !== "DISMISSED"
  );

  const pendingCount = updates.filter((u) => u.reviewState === "PENDING_REVIEW").length;

  return (
    <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200 space-y-4">
      {/* Header with tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Crisis Activity
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live field intelligence, command updates, and resource needs.
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {([
          { key: "overview" as Tab, label: "Overview" },
          { key: "feed" as Tab, label: `Feed${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { key: "needs" as Tab, label: `Needs${resourceNeedUpdates.length > 0 ? ` (${resourceNeedUpdates.length})` : ""}` },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-3 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "text-tide"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-tide" />
            )}
          </button>
        ))}
      </div>

      {/* Quick composer */}
      {canSubmitCommand && (
        <div className="space-y-3">
          {composerType === null ? (
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <button
                  key={action.type}
                  type="button"
                  onClick={() => setComposerType(action.type)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-tide hover:bg-cyan-50 hover:text-tide"
                >
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                  </svg>
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <QuickComposer
              type={composerType}
              crisisEventId={crisisEventId}
              currentStatus={crisisStatus}
              isAdmin={isAdmin}
              isTrainee={userTier === "TRAINEE"}
              onCancel={() => setComposerType(null)}
              onSubmit={() => {
                setComposerType(null);
                onRefresh();
              }}
            />
          )}
        </div>
      )}

      {canOpenCommandPanel && !canSubmitCommand && !isAdmin && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          Opt in from the Response Team panel to publish crisis-scoped field intelligence.
        </div>
      )}

      {!canOpenCommandPanel && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sign in as an active responder or admin to publish command updates. The verified timeline remains visible to all authenticated users.
        </div>
      )}

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          crisisStatus={crisisStatus}
          crisisSeverity={crisisSeverity}
          commandCenter={commandCenter}
        />
      )}

      {activeTab === "feed" && (
        <div className="space-y-3">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "FIELD_OBSERVATION", "STATUS_CHANGE", "RESOURCE_NEED", "CLOSURE_NOTE"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setFeedFilter(filter)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  feedFilter === filter
                    ? "bg-tide text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter === "ALL" ? "All" : UPDATE_TYPE_LABEL[filter]}
              </button>
            ))}
          </div>

          <UpdateTimeline
            entries={filteredUpdates}
            isAdmin={isAdmin}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {activeTab === "needs" && (
        <NeedsTab updates={updates} />
      )}
    </section>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  crisisStatus,
  crisisSeverity,
  commandCenter
}: {
  crisisStatus: CrisisEventStatus;
  crisisSeverity: IncidentSeverity;
  commandCenter: CrisisCommandCenter;
}) {
  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Current Status</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {STATUS_LABEL[crisisStatus]}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityBadgeClass(crisisSeverity)}`}>
          {crisisSeverity}
        </span>
        {commandCenter.lastVerifiedAt && (
          <span className="ml-auto text-xs text-slate-500">
            Last verified {new Date(commandCenter.lastVerifiedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Key metrics grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Access</p>
          <p className="mt-2 text-base font-semibold text-ink">
            {commandCenter.accessStatus ? ACCESS_STATUS_LABEL[commandCenter.accessStatus] : "No update"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {commandCenter.affectedArea ?? "Area not refined"}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Impact</p>
          <p className="mt-2 text-base font-semibold text-ink">
            {commandCenter.casualtyCount != null ? `${commandCenter.casualtyCount} casualties` : "No estimate"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {commandCenter.displacedCount != null ? `${commandCenter.displacedCount} displaced` : "No displacement data"}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Responders</p>
          <p className="mt-2 text-base font-semibold text-ink">
            {commandCenter.activeResponderCount ?? 0} active
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {commandCenter.responderCounts?.ON_SITE ?? 0} on site / {commandCenter.responderCounts?.EN_ROUTE ?? 0} en route
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Verification</p>
          <p className="mt-2 text-base font-semibold text-ink">
            {commandCenter.lastVerifiedBy ?? "Awaiting confirmation"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {commandCenter.latestUpdateType ? UPDATE_TYPE_LABEL[commandCenter.latestUpdateType] : "No update yet"}
          </p>
        </article>
      </div>

      {/* Current note + needs */}
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Current Command Note</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {commandCenter.latestNote ?? "No command note has been published yet."}
          </p>
          {commandCenter.damageNotes && (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-800">Damage: </span>
              {commandCenter.damageNotes}
            </p>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Urgent Needs</p>
          {commandCenter.resourceNeeds.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No urgent needs recorded.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {commandCenter.resourceNeeds.map((need, i) => (
                <span
                  key={`need-${i}`}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {need}
                </span>
              ))}
            </div>
          )}
          {commandCenter.closureChecklist && (
            <div className="mt-4 grid gap-2">
              {[
                { label: "Area safe", value: commandCenter.closureChecklist.areaSafe },
                { label: "People accounted", value: commandCenter.closureChecklist.peopleAccounted },
                { label: "Urgent needs stabilised", value: commandCenter.closureChecklist.urgentNeedsStabilized }
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${
                    item.value ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

// ── Needs Tab ───────────────────────────────────────────────────────────────

function NeedsTab({ updates }: { updates: CrisisUpdateEntry[] }) {
  const needUpdates = updates.filter(
    (u) => u.updateType === "RESOURCE_NEED" && u.reviewState !== "DISMISSED"
  );

  if (needUpdates.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
        No resource needs have been reported for this crisis yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {needUpdates.map((entry) => (
        <article
          key={entry.id}
          className={`rounded-xl border p-4 ${
            entry.reviewState === "PENDING_REVIEW"
              ? "border-amber-300 bg-amber-50/70"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{entry.updaterName}</p>
              <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
            {entry.reviewState === "PENDING_REVIEW" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Pending Review
              </span>
            )}
          </div>

          <p className="mt-2 text-sm leading-relaxed text-slate-700">{entry.updateNote}</p>

          {entry.resourceNeeds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.resourceNeeds.map((need, i) => (
                <span
                  key={`${entry.id}-${i}`}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {need}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

// ── Quick Composer (mini-forms) ─────────────────────────────────────────────

function QuickComposer({
  type,
  crisisEventId,
  currentStatus,
  isAdmin,
  isTrainee,
  onCancel,
  onSubmit
}: {
  type: Exclude<CrisisUpdateType, "RESPONDER_STATUS">;
  crisisEventId: string;
  currentStatus: CrisisEventStatus;
  isAdmin: boolean;
  isTrainee: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<CrisisEventStatus>(currentStatus);
  const [accessStatus, setAccessStatus] = useState<CrisisAccessStatus | "">("");
  const [casualtyCount, setCasualtyCount] = useState("");
  const [displacedCount, setDisplacedCount] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [resourceTags, setResourceTags] = useState("");
  const [closureAreaSafe, setClosureAreaSafe] = useState(false);
  const [closurePeopleAccounted, setClosurePeopleAccounted] = useState(false);
  const [closureNeedsStabilized, setClosureNeedsStabilized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!note.trim() && type !== "STATUS_CHANGE") {
      setError("Please enter a note");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload: CrisisUpdateInput = {
        updateType: type,
        status: type === "STATUS_CHANGE" || type === "CLOSURE_NOTE" ? status : currentStatus,
        updateNote: note.trim(),
      };

      if (type === "ACCESS_UPDATE" && accessStatus) {
        payload.accessStatus = accessStatus as CrisisAccessStatus;
      }

      if (type === "IMPACT_UPDATE") {
        if (casualtyCount) payload.casualtyCount = parseInt(casualtyCount, 10);
        if (displacedCount) payload.displacedCount = parseInt(displacedCount, 10);
        if (damageNotes.trim()) payload.damageNotes = damageNotes.trim();
      }

      if (type === "RESOURCE_NEED" && resourceTags.trim()) {
        payload.resourceNeeds = resourceTags.split(",").map((t) => t.trim()).filter(Boolean);
      }

      if (type === "CLOSURE_NOTE") {
        payload.closureChecklist = {
          areaSafe: closureAreaSafe,
          peopleAccounted: closurePeopleAccounted,
          urgentNeedsStabilized: closureNeedsStabilized,
        };
      }

      await submitCrisisUpdate(crisisEventId, payload);
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit update");
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = STATUS_ORDER.filter((s) => s !== currentStatus);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{UPDATE_TYPE_LABEL[type]}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>

      {isTrainee && (type === "FIELD_OBSERVATION" || type === "RESOURCE_NEED") && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Your submission will be reviewed by an admin before going live.
        </p>
      )}

      {/* Status selector for STATUS_CHANGE and CLOSURE_NOTE */}
      {(type === "STATUS_CHANGE" || type === "CLOSURE_NOTE") && (
        <div>
          <label className="text-xs font-semibold text-slate-600">
            {type === "CLOSURE_NOTE" ? "Target Status" : "New Status"}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CrisisEventStatus)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
          >
            {type === "CLOSURE_NOTE" ? (
              <>
                <option value={currentStatus}>{STATUS_LABEL[currentStatus]}</option>
                <option value="RESOLVED">Resolved</option>
                {isAdmin && <option value="CLOSED">Closed</option>}
              </>
            ) : (
              statusOptions.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Access status for ACCESS_UPDATE */}
      {type === "ACCESS_UPDATE" && (
        <div>
          <label className="text-xs font-semibold text-slate-600">Access Status</label>
          <select
            value={accessStatus}
            onChange={(e) => setAccessStatus(e.target.value as CrisisAccessStatus)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
          >
            <option value="">Select access status...</option>
            <option value="OPEN">Open</option>
            <option value="LIMITED">Limited</option>
            <option value="BLOCKED">Blocked</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
      )}

      {/* Impact fields for IMPACT_UPDATE */}
      {type === "IMPACT_UPDATE" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Casualties</label>
            <input
              type="number"
              min="0"
              value={casualtyCount}
              onChange={(e) => setCasualtyCount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Displaced</label>
            <input
              type="number"
              min="0"
              value={displacedCount}
              onChange={(e) => setDisplacedCount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
              placeholder="0"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Damage Notes</label>
            <input
              type="text"
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
              placeholder="Brief damage description"
            />
          </div>
        </div>
      )}

      {/* Resource tags for RESOURCE_NEED */}
      {type === "RESOURCE_NEED" && (
        <div>
          <label className="text-xs font-semibold text-slate-600">Resource Tags (comma-separated)</label>
          <input
            type="text"
            value={resourceTags}
            onChange={(e) => setResourceTags(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
            placeholder="e.g. Water, Medical Supplies, Boats"
          />
        </div>
      )}

      {/* Closure checklist for CLOSURE_NOTE */}
      {type === "CLOSURE_NOTE" && (
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: "Area Safe", value: closureAreaSafe, set: setClosureAreaSafe },
            { label: "People Accounted", value: closurePeopleAccounted, set: setClosurePeopleAccounted },
            { label: "Needs Stabilised", value: closureNeedsStabilized, set: setClosureNeedsStabilized },
          ].map((item) => (
            <label
              key={item.label}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer ${
                item.value ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
              }`}
            >
              <input
                type="checkbox"
                checked={item.value}
                onChange={(e) => item.set(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-tide focus:ring-tide"
              />
              {item.label}
            </label>
          ))}
        </div>
      )}

      {/* Note input (all types) */}
      <div>
        <label className="text-xs font-semibold text-slate-600">
          {type === "STATUS_CHANGE" ? "Reason for change" : "Note"}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={5000}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:outline-none"
          placeholder={
            type === "FIELD_OBSERVATION" ? "Describe what you observed on the ground..."
            : type === "RESOURCE_NEED" ? "What resources are urgently needed?"
            : type === "STATUS_CHANGE" ? "Why should the status change?"
            : type === "ACCESS_UPDATE" ? "Describe road access, blocked paths, or usable entry routes..."
            : type === "IMPACT_UPDATE" ? "Document casualty, displacement, or damage changes..."
            : type === "CLOSURE_NOTE" ? "Why is this crisis ready to resolve or close?"
            : "Add the official correction..."
          }
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-tide px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
