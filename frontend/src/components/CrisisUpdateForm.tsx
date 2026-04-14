import { useState } from "react";
import { submitCrisisUpdate } from "../services/api";
import { SEVERITY_OPTIONS } from "../utils/incident";
import type { IncidentSeverity } from "../types";

const STATUS_OPTIONS = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED",
  "RESOLVED",
  "CLOSED"
] as const;

type CrisisUpdateFormProps = {
  crisisEventId: string;
  currentStatus: string;
  onSubmit: () => void;
};

export function CrisisUpdateForm({ crisisEventId, currentStatus, onSubmit }: CrisisUpdateFormProps) {
  const [status, setStatus] = useState(currentStatus);
  const [updateNote, setUpdateNote] = useState("");
  const [newSeverity, setNewSeverity] = useState("");
  const [casualtyCount, setCasualtyCount] = useState("");
  const [displacedCount, setDisplacedCount] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await submitCrisisUpdate(crisisEventId, {
        status,
        updateNote,
        newSeverity: newSeverity || undefined,
        casualtyCount: casualtyCount ? parseInt(casualtyCount) : undefined,
        displacedCount: displacedCount ? parseInt(displacedCount) : undefined,
        damageNotes: damageNotes || undefined
      });
      onSubmit();
    } catch {
      alert("Failed to submit update");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Update Note</label>
        <textarea
          value={updateNote}
          onChange={(e) => setUpdateNote(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Describe what has changed..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Severity (Optional)</label>
        <select
          value={newSeverity}
          onChange={(e) => setNewSeverity(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">No change</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Casualties (Optional)</label>
          <input
            type="number"
            value={casualtyCount}
            onChange={(e) => setCasualtyCount(e.target.value)}
            min={0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Displaced (Optional)</label>
          <input
            type="number"
            value={displacedCount}
            onChange={(e) => setDisplacedCount(e.target.value)}
            min={0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Damage Notes (Optional)</label>
        <input
          type="text"
          value={damageNotes}
          onChange={(e) => setDamageNotes(e.target.value)}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Brief structural damage notes..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Submit Update"}
      </button>
    </form>
  );
}
