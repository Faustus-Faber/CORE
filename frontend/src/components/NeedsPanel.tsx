import { useEffect, useState } from "react";
import { getNeedsApi, getNeedsGapApi, createNeedApi } from "../services/api";

interface NeedsPanelProps {
  crisisEventId: string;
  isAdmin: boolean;
}

export function NeedsPanel({ crisisEventId, isAdmin }: NeedsPanelProps) {
  const [needs, setNeeds] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [error, setError] = useState("");

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      const [needsRes, gapsRes] = await Promise.all([
        getNeedsApi(crisisEventId),
        getNeedsGapApi(crisisEventId)
      ]);
      setNeeds(needsRes.needs);
      setGaps(gapsRes.gaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load needs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetch(); }, [crisisEventId]);

  const urgencyColors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-green-100 text-green-700"
  };

  if (loading) return <div className="p-4 text-sm text-slate-500">Loading needs...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Gap summary */}
      {gaps.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <h4 className="text-sm font-semibold text-orange-800">Unmet Needs ({gaps.length})</h4>
          <ul className="mt-2 space-y-1">
            {gaps.map((gap) => (
              <li key={gap.id} className="text-xs text-orange-700">
                <strong>{gap.needType}</strong>: {gap.gap} {gap.unit} needed ({gap.allocated} allocated of {gap.quantity})
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${urgencyColors[gap.urgency] ?? "bg-slate-100"}`}>
                  {gap.urgency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Needs list */}
      <div className="space-y-2">
        {needs.length === 0 ? (
          <p className="text-sm text-slate-500">No needs identified yet.</p>
        ) : (
          needs.map((need) => {
            const allocated = need.allocations?.reduce((s: number, a: any) => s + a.quantity, 0) ?? 0;
            return (
              <div key={need.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${urgencyColors[need.urgency] ?? "bg-slate-100"}`}>
                      {need.urgency}
                    </span>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {need.needType}: {need.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {allocated}/{need.quantity} {need.unit} allocated
                      {need.isMet && <span className="ml-2 text-green-600">✓ Met</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isAdmin && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-tide px-3 py-1.5 text-sm font-semibold text-white hover:bg-tide/90"
        >
          {showForm ? "Cancel" : "+ Add Need"}
        </button>
      )}

      {showForm && (
        <NeedForm
          crisisEventId={crisisEventId}
          onCreated={() => { setShowForm(false); void fetch(); }}
        />
      )}
    </div>
  );
}

function NeedForm({ crisisEventId, onCreated }: { crisisEventId: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    needType: "",
    description: "",
    quantity: 1,
    unit: "units",
    urgency: "MEDIUM"
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createNeedApi({ ...form, crisisEventId });
      onCreated();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input
        type="text"
        placeholder="Need type (e.g. rescue_boat)"
        value={form.needType}
        onChange={(e) => setForm({ ...form, needType: e.target.value })}
        className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
        required
      />
      <input
        type="text"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
        required
      />
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          className="w-24 rounded border border-slate-200 px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="w-32 rounded border border-slate-200 px-3 py-1.5 text-sm"
        />
        <select
          value={form.urgency}
          onChange={(e) => setForm({ ...form, urgency: e.target.value })}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option>CRITICAL</option>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-tide px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Need"}
      </button>
    </form>
  );
}
