import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../services/api";
import { SkeletonCard } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { useToast } from "../components/ui/Toast";

interface UnpublishedReport {
  id: string;
  incidentTitle: string;
  description: string;
  incidentType: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  severityLevel: string;
  createdAt: string;
  detectedLanguage: string | null;
  translatedDescription: string | null;
  credibilityScore: number;
  mediaFilenames: string[];
  sourceAudioFilename: string | null;
}

interface CandidateEvent {
  id: string;
  title: string;
  status: string;
  severityLevel: string;
  locationText: string;
  reportCount: number;
  similarityScore?: number;
}

interface ClaimSummary {
  id: string;
  claimType: string;
  subject: string;
  value: string;
  evidenceState: string;
  conflictCount: number;
  supportCount: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-critical/10 text-critical",
  HIGH: "bg-amber/10 text-amber",
  MEDIUM: "bg-teal/10 text-teal",
  LOW: "bg-muted/10 text-muted",
};

export function VerificationQueuePage() {
  const [reports, setReports] = useState<UnpublishedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<UnpublishedReport | null>(null);
  const [candidates, setCandidates] = useState<CandidateEvent[]>([]);
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { showToast } = useToast();

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const response = await apiFetch("/admin/reports/unpublished?page=1&limit=12");
      const data = await response.json();
      setReports(data.reports ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchReportDetail = useCallback(async (reportId: string) => {
    try {
      setDetailLoading(true);
      const [reportRes, candidatesRes] = await Promise.all([
        apiFetch(`/reports/${reportId}`),
        apiFetch(`/triage/signals/${reportId}/candidates`).catch(() => null),
      ]);

      let reportData: any = null;
      if (reportRes.ok) {
        reportData = await reportRes.json();
        setSelectedReport(reportData);
      }

      if (candidatesRes?.ok) {
        const candidatesData = await candidatesRes.json();
        setCandidates(candidatesData.candidates ?? []);
      } else {
        setCandidates([]);
      }

      // Fetch claims for the linked crisis event (if any)
      const crisisId = reportData?.crisisEventId ?? reportData?.crisisEvent?.id;
      if (crisisId) {
        try {
          const claimsRes = await apiFetch(`/claims/crisis/${crisisId}`);
          if (claimsRes.ok) {
            const claimsData = await claimsRes.json();
            setClaims(claimsData.claims ?? claimsData.data ?? []);
          } else {
            setClaims([]);
          }
        } catch {
          setClaims([]);
        }
      } else {
        setClaims([]);
      }
    } catch {
      showToast("Failed to load report details", "error");
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const response = await apiFetch("/admin/reports/unpublished?page=1&limit=12");
        const data = await response.json();
        if (cancelled) return;
        setReports(data.reports ?? []);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void doFetch();
    return () => { cancelled = true; };
  }, []);

  const handleAction = async (action: string, reportId: string, targetEventId?: string) => {
    setActionLoading(true);
    try {
      // Map UI actions to admin status update endpoint
      let endpoint: string;
      let method: string;
      let payload: Record<string, unknown>;

      if (action === "publish") {
        // Publish the report — admin status update
        endpoint = `/admin/reports/${reportId}/status`;
        method = "PATCH";
        payload = { status: "PUBLISHED" };
      } else if (action === "reject") {
        // Reject — mark as under review / spam
        endpoint = `/admin/reports/${reportId}/status`;
        method = "PATCH";
        payload = { status: "REJECTED" };
      } else if (action === "link" && targetEventId) {
        // Link report to an existing crisis event (manual merge)
        endpoint = `/admin/reports/${reportId}/crisis-link`;
        method = "POST";
        payload = { crisisEventId: targetEventId };
      } else {
        // For "clarification" — request clarification from reporter
        endpoint = `/admin/reports/${reportId}/status`;
        method = "PATCH";
        payload = { status: "CLARIFICATION_REQUESTED" };
      }

      const response = await apiFetch(endpoint, {
        method: method as "PATCH" | "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showToast(`Report ${action}ed successfully`, "success");
        setSelectedReport(null);
        fetchReports();
      } else {
        const error = await response.json().catch(() => ({}));
        showToast(error.message ?? `Failed to ${action} report`, "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Verification Queue</h1>

      {/* §14.4: Recoverable error state with retry */}
      {loadError && !loading && (
        <ErrorState
          message="Failed to load verification queue"
          detail="Could not reach the server. Check your connection and try again."
          onRetry={() => void fetchReports()}
        />
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Left: Report list */}
        <div className="bg-panel-white rounded-lg shadow-panel overflow-y-auto max-h-[calc(100vh-180px)]">
          <h2 className="px-4 py-3 text-sm font-semibold text-ink border-b border-muted/10">
            Pending Review ({reports.length})
          </h2>
          {loading ? (
            <div className="p-4 space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : reports.length === 0 ? (
            <p className="p-4 text-sm text-muted">No reports pending review.</p>
          ) : (
            <div className="divide-y divide-muted/5">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => {
                    setSelectedReport(report);
                    fetchReportDetail(report.id);
                  }}
                  className={`w-full text-left p-4 transition ${
                    selectedReport?.id === report.id ? "bg-teal/5" : "hover:bg-canvas"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-semibold text-ink truncate">{report.incidentTitle}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[report.severityLevel] ?? ""}`}>
                      {report.severityLevel}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">{report.locationText}</p>
                  <p className="text-xs text-muted mt-1">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Report detail with raw/AI/candidates/contradictions */}
        <div className="bg-panel-white rounded-lg shadow-panel overflow-y-auto max-h-[calc(100vh-180px)]">
          {detailLoading ? (
            <div className="p-6 space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : selectedReport ? (
            <div className="p-6 space-y-6">
              {/* Raw text */}
              <div>
                <h2 className="text-lg font-semibold text-ink mb-2">{selectedReport.incidentTitle}</h2>
                <div className="bg-canvas rounded-md p-4">
                  <h3 className="text-xs font-semibold text-muted uppercase mb-2">Raw Description</h3>
                  <p className="text-sm text-ink">{selectedReport.description}</p>
                  {selectedReport.detectedLanguage && (
                    <p className="text-xs text-muted mt-2">Language: {selectedReport.detectedLanguage}</p>
                  )}
                </div>
              </div>

              {/* AI translation */}
              {selectedReport.translatedDescription && (
                <div className="bg-teal/5 rounded-md p-4">
                  <h3 className="text-xs font-semibold text-teal uppercase mb-2">AI Translation</h3>
                  <p className="text-sm text-ink">{selectedReport.translatedDescription}</p>
                </div>
              )}

              {/* Extracted claims */}
              {claims.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-2">Extracted Claims</h3>
                  <div className="space-y-2">
                    {claims.map((claim) => (
                      <div key={claim.id} className="bg-canvas rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-teal">
                            {claim.claimType.replace(/_/g, " ").toLowerCase()}
                          </span>
                          <span className={`text-xs ${
                            claim.conflictCount > 0 ? "text-critical" : "text-success"
                          }`}>
                            {claim.evidenceState.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </div>
                        <p className="text-sm text-ink">{claim.subject}: {claim.value}</p>
                        {claim.conflictCount > 0 && (
                          <p className="text-xs text-critical mt-1">
                            ⚠ {claim.conflictCount} conflicting claim(s)
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate events */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">Candidate Events</h3>
                {candidates.length > 0 ? (
                  <div className="space-y-2">
                    {candidates.map((candidate) => (
                      <div key={candidate.id} className="flex items-center justify-between bg-canvas rounded-md p-3">
                        <div>
                          <Link
                            to={`/dashboard/incidents/${candidate.id}`}
                            className="text-sm font-medium text-teal hover:underline"
                          >
                            {candidate.title}
                          </Link>
                          <p className="text-xs text-muted">{candidate.locationText} · {candidate.reportCount} reports</p>
                        </div>
                        <button
                          onClick={() => handleAction("link", selectedReport.id, candidate.id)}
                          disabled={actionLoading}
                          className="text-xs px-3 py-1.5 bg-teal text-white rounded-md hover:bg-teal/90 disabled:opacity-50"
                        >
                          Link
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No similar events found. This may be a new crisis.</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-muted/10">
                <button
                  onClick={() => handleAction("publish", selectedReport.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-success rounded-md hover:bg-success/90 disabled:opacity-50"
                >
                  Publish as New Event
                </button>
                <button
                  onClick={() => handleAction("reject", selectedReport.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-critical border border-critical/30 rounded-md hover:bg-critical/5 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction("clarification", selectedReport.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-amber border border-amber/30 rounded-md hover:bg-amber/5 disabled:opacity-50"
                >
                  Request Clarification
                </button>
                <button
                  onClick={() => handleAction("hold", selectedReport.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-muted border border-muted/30 rounded-md hover:bg-muted/5 disabled:opacity-50"
                >
                  Hold for Review
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted">Select a report to review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
