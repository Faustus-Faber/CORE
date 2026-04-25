import { useState } from "react";

import { revertCrisisStatus, submitCrisisUpdate } from "../services/api";
import type { CrisisEventStatusExpanded } from "../types";

const STATUS_OPTIONS: CrisisEventStatusExpanded[] = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED",
  "RESOLVED",
  "CLOSED"
];

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type AdminCrisisControlsProps = {
  crisisEventId: string;
  currentStatus: CrisisEventStatusExpanded;
  onReverted: () => void;
};

export function AdminCrisisControls({
  crisisEventId,
  currentStatus,
  onReverted
}: AdminCrisisControlsProps) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState(currentStatus);
  const [revertNote, setRevertNote] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState<"revert" | "correction" | null>(null);
  const [error, setError] = useState("");

  const canSubmitRevert =
    submittingAction == null &&
    targetStatus !== currentStatus &&
    revertNote.trim().length > 0;

  const canSubmitCorrection =
    submittingAction == null &&
    correctionNote.trim().length > 0;

  const handleRevert = async () => {
    setError("");
    setSubmittingAction("revert");
    try {
      await revertCrisisStatus(crisisEventId, targetStatus, revertNote.trim());
      setOpen(false);
      setRevertNote("");
      onReverted();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to revert crisis status"
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleCorrection = async () => {
    setError("");
    setSubmittingAction("correction");
    try {
      await submitCrisisUpdate(crisisEventId, {
        updateType: "ADMIN_CORRECTION",
        status: currentStatus,
        updateNote: correctionNote.trim()
      });
      setCorrectionNote("");
      onReverted();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to publish correction note"
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-800">
            Admin Controls
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Revert the command status or publish an official correction note.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          {open ? "Hide Controls" : "Show Controls"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-amber-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Revert Crisis Status</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Move the crisis back to a prior state with a permanent audit reason.
            </p>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Target Status
              </label>
              <select
                value={targetStatus}
                onChange={(event) =>
                  setTargetStatus(event.target.value as CrisisEventStatusExpanded)
                }
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Audit Reason
              </label>
              <textarea
                value={revertNote}
                onChange={(event) => setRevertNote(event.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Explain why this status should be reverted."
              />
            </div>

            <button
              type="button"
              onClick={() => void handleRevert()}
              disabled={!canSubmitRevert}
              className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "revert" ? "Reverting..." : "Confirm Revert"}
            </button>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Correction Note</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Add a verified correction to the timeline without changing the current status.
            </p>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              Current status: {formatLabel(currentStatus)}
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Correction
              </label>
              <textarea
                value={correctionNote}
                onChange={(event) => setCorrectionNote(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Document the official correction for the public timeline."
              />
            </div>

            <button
              type="button"
              onClick={() => void handleCorrection()}
              disabled={!canSubmitCorrection}
              className="mt-4 w-full rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "correction"
                ? "Publishing..."
                : "Publish Correction Note"}
            </button>
          </section>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
