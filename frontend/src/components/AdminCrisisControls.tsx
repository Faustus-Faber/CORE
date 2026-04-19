import { useState } from "react";

import { revertCrisisStatus } from "../services/api";

const STATUS_OPTIONS = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED",
  "RESOLVED",
  "CLOSED"
] as const;

type AdminCrisisControlsProps = {
  crisisEventId: string;
  currentStatus: string;
  onReverted: () => void;
};

export function AdminCrisisControls({
  crisisEventId,
  currentStatus,
  onReverted
}: AdminCrisisControlsProps) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !submitting &&
    targetStatus !== currentStatus &&
    note.trim().length > 0;

  const handleRevert = async () => {
    setSubmitting(true);
    try {
      await revertCrisisStatus(crisisEventId, targetStatus, note.trim());
      setOpen(false);
      setNote("");
      onReverted();
    } catch {
      alert("Failed to revert status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Admin Controls</p>
          <p className="text-xs text-amber-700 mt-0.5">Revert the crisis to a prior status with an audit note.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          {open ? "Cancel" : "Revert Status"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="block text-xs font-semibold text-amber-800 mb-1">Target Status</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-amber-800 mb-1">Reason</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="Why is this status being reverted?"
            />
          </div>
          <button
            type="button"
            onClick={handleRevert}
            disabled={!canSubmit}
            className="w-full rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "Reverting..." : "Confirm Revert"}
          </button>
        </div>
      )}
    </div>
  );
}
