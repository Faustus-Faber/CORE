import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../services/api";
import { SkeletonCard } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { ConfirmDialog } from "../components/ui/AccessibleDialog";

interface Need {
  id: string;
  needType: string;
  description: string;
  quantity: number;
  unit: string;
  urgency: string;
  isMet: boolean;
}

interface CandidateResponder {
  id: string;
  fullName: string;
  skills: string[];
  distanceKm?: number;
  availabilityStatus?: string;
  assignmentReliability?: number;
}

interface CandidateResource {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  distanceKm?: number;
  availableQuantity?: number;
}

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: "text-critical",
  HIGH: "text-amber",
  MEDIUM: "text-teal",
  LOW: "text-muted",
};

export function ResponsePlanPage() {
  const { crisisId } = useParams<{ crisisId: string }>();
  const [needs, setNeeds] = useState<Need[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [responders, setResponders] = useState<CandidateResponder[]>([]);
  const [resources, setResources] = useState<CandidateResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: string; label: string } | null>(null);
  const { showToast } = useToast();

  const fetchNeeds = useCallback(async () => {
    if (!crisisId) return;
    try {
      setLoading(true);
      const response = await apiFetch(`/crises/${crisisId}/needs`);
      if (!response.ok) throw new Error("Failed to load needs");
      const data = await response.json();
      setNeeds(data.data ?? data ?? []);
    } catch {
      showToast("Failed to load needs", "error");
    } finally {
      setLoading(false);
    }
  }, [crisisId, showToast]);

  const fetchCandidates = useCallback(async (need: Need) => {
    if (!crisisId) return;
    try {
      setDetailLoading(true);
      setSelectedNeed(need);
      const [responderRes, resourceRes] = await Promise.all([
        apiFetch(`/crises/${crisisId}/needs/${need.id}/candidate-responders`).catch(() => null),
        apiFetch(`/crises/${crisisId}/needs/${need.id}/candidate-resources`).catch(() => null),
      ]);

      if (responderRes?.ok) {
        const data = await responderRes.json();
        setResponders(data.data ?? data ?? []);
      } else {
        setResponders([]);
      }

      if (resourceRes?.ok) {
        const data = await resourceRes.json();
        setResources(data.data ?? data ?? []);
      } else {
        setResources([]);
      }
    } catch {
      showToast("Failed to load candidates", "error");
    } finally {
      setDetailLoading(false);
    }
  }, [crisisId, showToast]);

  useEffect(() => {
    fetchNeeds();
  }, [fetchNeeds]);

  const handleConfirm = async () => {
    if (!confirmAction || !crisisId) return;
    try {
      const response = await apiFetch(`/crises/${crisisId}/action-drafts/${confirmAction.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        showToast(`${confirmAction.label} confirmed`, "success");
        fetchNeeds();
      } else {
        showToast("Confirmation failed", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setConfirmAction(null);
    }
  };

  const unmetNeeds = needs.filter((n) => !n.isMet);
  const metNeeds = needs.filter((n) => n.isMet);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Response Plan</h1>
        <Link
          to={`/dashboard/incidents/${crisisId}`}
          className="text-sm text-teal hover:underline"
        >
          ← Back to Crisis
        </Link>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Left: Needs list */}
        <div className="bg-panel-white rounded-lg shadow-panel overflow-y-auto max-h-[calc(100vh-180px)]">
          <h2 className="px-4 py-3 text-sm font-semibold text-ink border-b border-muted/10">
            Needs ({unmetNeeds.length} unmet)
          </h2>
          {loading ? (
            <div className="p-4 space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : unmetNeeds.length === 0 && metNeeds.length === 0 ? (
            <p className="p-4 text-sm text-muted">No needs recorded yet.</p>
          ) : (
            <div className="divide-y divide-muted/5">
              {unmetNeeds.length > 0 && (
                <p className="px-4 pt-3 text-xs font-semibold text-amber uppercase">Unmet</p>
              )}
              {unmetNeeds.map((need) => (
                <button
                  key={need.id}
                  onClick={() => fetchCandidates(need)}
                  className={`w-full text-left p-4 transition ${
                    selectedNeed?.id === need.id ? "bg-teal/5" : "hover:bg-canvas"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-ink">{need.needType}</span>
                    <span className={`text-xs font-medium ${URGENCY_COLORS[need.urgency] ?? "text-muted"}`}>
                      {need.urgency}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{need.description}</p>
                  <p className="text-xs text-muted mt-1">
                    {need.quantity} {need.unit} needed
                  </p>
                </button>
              ))}
              {metNeeds.length > 0 && (
                <p className="px-4 pt-3 text-xs font-semibold text-success uppercase">Met</p>
              )}
              {metNeeds.map((need) => (
                <div key={need.id} className="p-4 opacity-60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-ink">{need.needType}</span>
                    <span className="text-xs text-success">✓ Met</span>
                  </div>
                  <p className="text-xs text-muted">{need.quantity} {need.unit}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Candidates and constraints */}
        <div className="bg-panel-white rounded-lg shadow-panel overflow-y-auto max-h-[calc(100vh-180px)]">
          {detailLoading ? (
            <div className="p-6 space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : selectedNeed ? (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-ink mb-1">{selectedNeed.needType}</h2>
                <p className="text-sm text-muted">{selectedNeed.description}</p>
                <p className="text-sm text-ink mt-2">
                  Required: <strong>{selectedNeed.quantity} {selectedNeed.unit}</strong>
                  {" — "}
                  <span className={URGENCY_COLORS[selectedNeed.urgency] ?? "text-muted"}>
                    {selectedNeed.urgency} urgency
                  </span>
                </p>
              </div>

              {/* Candidate responders */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-3">Candidate Responders</h3>
                {responders.length > 0 ? (
                  <div className="space-y-2">
                    {responders.map((responder) => (
                      <div key={responder.id} className="bg-canvas rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ink">{responder.fullName}</span>
                          <button
                            onClick={() => setConfirmAction({
                              type: "dispatch",
                              id: responder.id,
                              label: `Dispatch ${responder.fullName}`,
                            })}
                            className="text-xs px-3 py-1.5 bg-teal text-white rounded-md hover:bg-teal/90"
                          >
                            Propose Assignment
                          </button>
                        </div>
                        <div className="text-xs text-muted space-y-1">
                          {responder.skills.length > 0 && (
                            <p>Skills: {responder.skills.join(", ")}</p>
                          )}
                          {responder.distanceKm != null && (
                            <p>Distance: {responder.distanceKm.toFixed(1)} km</p>
                          )}
                          {responder.availabilityStatus && (
                            <p>Availability: {responder.availabilityStatus}</p>
                          )}
                          {responder.assignmentReliability != null && (
                            <p>Reliability: {responder.assignmentReliability.toFixed(1)}%</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No matching responders found.</p>
                )}
              </div>

              {/* Candidate resources */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-3">Candidate Resources</h3>
                {resources.length > 0 ? (
                  <div className="space-y-2">
                    {resources.map((resource) => (
                      <div key={resource.id} className="bg-canvas rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ink">{resource.name}</span>
                          <button
                            onClick={() => setConfirmAction({
                              type: "allocation",
                              id: resource.id,
                              label: `Allocate ${resource.name}`,
                            })}
                            className="text-xs px-3 py-1.5 bg-teal text-white rounded-md hover:bg-teal/90"
                          >
                            Propose Allocation
                          </button>
                        </div>
                        <div className="text-xs text-muted space-y-1">
                          <p>Category: {resource.category}</p>
                          <p>Available: {resource.availableQuantity ?? resource.quantity} {resource.unit}</p>
                          {resource.distanceKm != null && (
                            <p>Distance: {resource.distanceKm.toFixed(1)} km</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No matching resources found nearby.</p>
                )}
              </div>

              {/* Constraint explanation */}
              <div className="bg-teal/5 rounded-md p-4">
                <h3 className="text-sm font-semibold text-teal mb-2">Why these recommendations?</h3>
                <p className="text-xs text-muted">
                  Candidates are ranked by skill match, distance, availability status,
                  and assignment reliability. All proposals require coordinator confirmation
                  before dispatch or allocation.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted">Select an unmet need to see candidates.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title="Confirm Action"
        message={confirmAction?.label ?? "Are you sure you want to proceed?"}
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
