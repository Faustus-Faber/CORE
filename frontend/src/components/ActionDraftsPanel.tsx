import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  listCopilotDraftsApi,
  confirmCopilotDraftApi,
  rejectCopilotDraftApi,
  type CopilotDraft,
} from "../services/api";

interface ActionDraftsPanelProps {
  crisisEventId: string;
  isAdmin: boolean;
  /** Refresh trigger — when this changes, the panel refetches */
  refreshKey?: number;
}

const DRAFT_TYPE_STYLES: Record<string, { bg: string; label: string }> = {
  DISPATCH:       { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Dispatch Responder" },
  ALLOCATION:     { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Resource Allocation" },
  STATUS_CHANGE:  { bg: "bg-cyan-50 text-tide border-cyan-200", label: "Crisis Status Change" },
  ALERT:          { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Public Broadcast Alert" },
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
  EXPIRED:   "bg-slate-100 text-slate-400 border-slate-200",
};

function formatPayload(draft: CopilotDraft): Array<{ label: string; value: string }> {
  try {
    const payload = JSON.parse(draft.payload);
    const fields: Array<{ label: string; value: string }> = [];
    const { _crisisVersionAtCreation, ...rest } = payload;

    for (const [key, value] of Object.entries(rest)) {
      const displayKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/Id$/, " ID");

      let displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);

      if (!displayValue || displayValue.trim() === "" || displayValue === "null" || displayValue === "undefined") {
        displayValue = "Auto-Assign Nearest Responder Team";
      }

      fields.push({
        label: displayKey,
        value: displayValue,
      });
    }
    return fields;
  } catch {
    return [{ label: "Payload", value: draft.payload }];
  }
}

function isExpiringSoon(expiresAt: string): boolean {
  const hours = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
  return hours < 2 && hours > 0;
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function ActionDraftsPanel({ crisisEventId, isAdmin, refreshKey }: ActionDraftsPanelProps) {
  const [drafts, setDrafts] = useState<CopilotDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, { executed: boolean; result?: any; error?: string }>>({});
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await listCopilotDraftsApi(crisisEventId);
      setDrafts(response.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load action drafts");
    } finally {
      setLoading(false);
    }
  }, [crisisEventId]);

  useEffect(() => {
    void fetchDrafts();
  }, [fetchDrafts, refreshKey]);

  const handleConfirm = async (draftId: string) => {
    setActionLoading(draftId);
    try {
      const result = await confirmCopilotDraftApi(draftId);
      setExecutionResults((prev) => ({ ...prev, [draftId]: result.executionResult as { executed: boolean; result?: any; error?: string } }));
      await fetchDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm draft");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (draftId: string) => {
    setActionLoading(draftId);
    try {
      await rejectCopilotDraftApi(draftId);
      await fetchDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject draft");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && drafts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 italic">
        Loading action draft queue…
      </div>
    );
  }

  if (error && drafts.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
        {error}
      </div>
    );
  }

  const pending = drafts.filter((d) => d.status === "PENDING");
  const resolved = drafts.filter((d) => d.status !== "PENDING");

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Pending Drafts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-1.5">
            <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Pending Coordinator Confirmation ({pending.length})</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">Real-time Draft Queue</span>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 italic">
            No pending action drafts requiring coordinator review. Click "Propose AI Action" above to auto-generate a draft proposal.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((draft) => {
              const typeStyle = DRAFT_TYPE_STYLES[draft.draftType] ?? DRAFT_TYPE_STYLES.DISPATCH;
              const payloadFields = formatPayload(draft);
              const expired = isExpired(draft.expiresAt);
              const expiringSoon = isExpiringSoon(draft.expiresAt);
              const execResult = executionResults[draft.id];

              return (
                <div
                  key={draft.id}
                  className={`rounded-xl border p-4 shadow-panel ring-1 transition-all ${
                    expired
                      ? "border-slate-200 bg-slate-50 opacity-70"
                      : "border-[#0e7490]/30 bg-white ring-[#0e7490]/20"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${typeStyle.bg}`}>
                        {typeStyle.label}
                      </span>
                      {expired && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Expired</span>
                      )}
                      {expiringSoon && !expired && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Expires Soon</span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Proposed by <span className="text-ink font-bold">{draft.proposedBy?.fullName ?? "AI Copilot"}</span>
                    </span>
                  </div>

                  {/* Reasoning with ReactMarkdown */}
                  <div className="prose prose-xs max-w-none text-xs text-slate-800 font-medium mb-3 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.reasoning}</ReactMarkdown>
                  </div>

                  {/* Payload details */}
                  {payloadFields.length > 0 && (
                    <div className="rounded-lg bg-tide/5 p-3 mb-3 border border-cyan-200/80">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-tide mb-1">
                        Proposed System Modifications
                      </p>
                      <dl className="space-y-1">
                        {payloadFields.map((field, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <dt className="text-slate-500 font-medium">{field.label}:</dt>
                            <dd className="font-bold text-ink">{field.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* Execution result */}
                  {execResult && (
                    <div className={`rounded-lg p-3 mb-3 border ${execResult.executed ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                      <p className="text-xs font-bold">
                        {execResult.executed ? "✓ Action Confirmed & Executed Successfully" : "✗ Execution Failed"}
                      </p>
                      {execResult.error && (
                        <p className="text-xs mt-1">{execResult.error}</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {isAdmin && !execResult && (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => void handleConfirm(draft.id)}
                        disabled={actionLoading === draft.id || expired}
                        className="flex-1 rounded-xl bg-tide px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-tide/90 active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === draft.id ? "Executing..." : "✓ Confirm & Execute Action"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReject(draft.id)}
                        disabled={actionLoading === draft.id}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-95 disabled:opacity-50"
                      >
                        Reject Draft
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible Resolved History */}
      {resolved.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Execution Log History ({resolved.length})
            </h4>
            <button
              type="button"
              onClick={() => setIsHistoryCollapsed((prev) => !prev)}
              className="text-xs font-bold text-tide hover:underline flex items-center gap-1"
            >
              <span>{isHistoryCollapsed ? `Show Execution Logs (${resolved.length}) ▼` : "Collapse Execution Logs ▲"}</span>
            </button>
          </div>

          {!isHistoryCollapsed && (
            <div className="space-y-2.5 animate-fade-in">
              {resolved.map((draft) => {
                const typeStyle = DRAFT_TYPE_STYLES[draft.draftType] ?? DRAFT_TYPE_STYLES.DISPATCH;
                const payloadFields = formatPayload(draft);
                return (
                  <div key={draft.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-bold border ${typeStyle.bg}`}>
                          {typeStyle.label}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${STATUS_STYLES[draft.status] ?? STATUS_STYLES.CANCELLED}`}>
                          {draft.status}
                        </span>
                      </div>
                      {draft.confirmedBy && (
                        <span className="text-[10px] text-slate-400 font-mono">Confirmed by {draft.confirmedBy.fullName}</span>
                      )}
                    </div>

                    <div className="prose prose-xs max-w-none text-xs text-slate-700 leading-relaxed font-medium">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.reasoning}</ReactMarkdown>
                    </div>

                    {payloadFields.length > 0 && (
                      <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Executed System Modifications
                        </p>
                        <dl className="space-y-0.5">
                          {payloadFields.map((field, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <dt className="text-slate-500 font-medium">{field.label}:</dt>
                              <dd className="font-bold text-ink">{field.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
