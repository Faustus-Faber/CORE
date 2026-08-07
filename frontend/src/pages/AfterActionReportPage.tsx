import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getDashboardFeed,
  listNGOReports,
  createDraftReport,
  updateReportSections,
  generateReportPDF,
  NGOReport,
  ReportSections,
} from "../services/api";
import type { CrisisEventCard } from "../types";
import { useAuth } from "../context/AuthContext";
import { SkeletonCard } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

const AAR_ELIGIBLE_STATUSES = new Set(["RESOLVED", "CLOSED"]);

const SECTION_META: { key: keyof ReportSections; label: string; rows: number }[] = [
  { key: "executiveSummary", label: "Executive Summary", rows: 4 },
  { key: "incidentDetails", label: "Incident Details", rows: 6 },
  { key: "timeline", label: "Timeline of Events", rows: 8 },
  { key: "resourceUtilization", label: "Resource Utilization", rows: 6 },
  { key: "volunteerInvolvement", label: "Volunteer Involvement", rows: 6 },
  { key: "evidenceSummary", label: "Visual Evidence Summary", rows: 4 },
  { key: "impactAssessment", label: "Impact Assessment", rows: 6 },
  { key: "appendix", label: "Appendix: OCR & Document Data", rows: 4 },
];

function parseSections(json: string | null): ReportSections {
  if (!json) {
    return {
      executiveSummary: "",
      incidentDetails: "",
      timeline: "",
      resourceUtilization: "",
      volunteerInvolvement: "",
      evidenceSummary: "",
      impactAssessment: "",
      appendix: "",
    };
  }
  try {
    return JSON.parse(json) as ReportSections;
  } catch {
    return {
      executiveSummary: "",
      incidentDetails: "",
      timeline: "",
      resourceUtilization: "",
      volunteerInvolvement: "",
      evidenceSummary: "",
      impactAssessment: "",
      appendix: "",
    };
  }
}

export function AfterActionReportPage() {
  const { crisisId } = useParams<{ crisisId: string }>();
  const [selectedCrisisId, setSelectedCrisisId] = useState<string | null>(crisisId ?? null);
  const [crises, setCrises] = useState<CrisisEventCard[]>([]);
  const [crisesLoading, setCrisesLoading] = useState(false);

  const [reports, setReports] = useState<NGOReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<NGOReport | null>(null);
  const [sections, setSections] = useState<ReportSections | null>(null);
  const [editingSection, setEditingSection] = useState<keyof ReportSections | null>(null);
  const [dirty, setDirty] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Fetch eligible crises (RESOLVED, CLOSED)
  useEffect(() => {
    setCrisesLoading(true);
    getDashboardFeed()
      .then((feed) => {
        const eligible = feed.feed.filter((c) => AAR_ELIGIBLE_STATUSES.has(c.status));
        setCrises(eligible);
        if (!selectedCrisisId && eligible.length > 0) {
          setSelectedCrisisId(eligible[0].id);
        }
      })
      .catch(() => showToastRef.current("Failed to load crises", "error"))
      .finally(() => setCrisesLoading(false));
  }, []);

  // Fetch reports for selected crisis
  useEffect(() => {
    if (!selectedCrisisId) {
      setReports([]);
      setSelectedReport(null);
      setSections(null);
      return;
    }
    listNGOReports(selectedCrisisId)
      .then((r) => {
        setReports(r);
        if (r.length > 0) {
          setSelectedReport(r[0]);
          setSections(parseSections(r[0].sectionsJson));
        } else {
          setSelectedReport(null);
          setSections(null);
        }
      })
      .catch(() => showToastRef.current("Failed to load reports", "error"));
  }, [selectedCrisisId]);

  const selectedCrisis = crises.find((c) => c.id === selectedCrisisId);

  const handleGenerate = async () => {
    if (!selectedCrisisId) return;
    setGenerating(true);
    try {
      const report = await createDraftReport(selectedCrisisId);
      showToast("After-action report draft created! Review and edit sections below.", "success");
      const updated = await listNGOReports(selectedCrisisId);
      setReports(updated);
      setSelectedReport(report);
      setSections(parseSections(report.sectionsJson));
      setDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate report";
      showToast(message, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSection = async (key: keyof ReportSections, content: string) => {
    if (!selectedReport || !sections) return;
    setSaving(true);
    try {
      const updated = await updateReportSections(selectedReport.id, { [key]: content });
      setSections(parseSections(updated.sectionsJson));
      setEditingSection(null);
      setDirty(false);
      showToast("Section saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save section";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!selectedReport) return;
    setGeneratingPdf(true);
    try {
      const updated = await generateReportPDF(selectedReport.id);
      showToast("PDF generated successfully!", "success");
      const refreshed = await listNGOReports(selectedCrisisId!);
      setReports(refreshed);
      setSelectedReport(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate PDF";
      showToast(message, "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header Container */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-tide/10 p-3 text-tide">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Link to="/operations" className="text-tide hover:underline">Crisis Ops</Link>
                <span>/</span>
                <span>After-Action Reports</span>
              </div>
              <h1 className="text-xl font-bold text-ink">After-Action Reports &amp; NGO Audits</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate &amp; edit official after-action reports for concluded incidents (<span className="font-bold text-tide">RESOLVED</span>, <span className="font-bold text-tide">CLOSED</span>)
              </p>
            </div>
          </div>

          {/* Crisis Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Concluded Crisis:</span>
            {crisesLoading ? (
              <SkeletonCard className="h-8 w-64" />
            ) : (
              <select
                value={selectedCrisisId ?? ""}
                onChange={(e) => setSelectedCrisisId(e.target.value || null)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide max-w-[300px]"
              >
                {crises.length === 0 && <option value="">No concluded crises</option>}
                {crises.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {crises.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Concluded Incident:</span>
              <span className="text-xs font-bold text-tide">{selectedCrisis?.title ?? "Loading..."}</span>
              {selectedCrisis && (
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedCrisis.status}
                </span>
              )}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !selectedCrisisId}
                className="rounded-xl bg-tide px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-tide/90 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>{generating ? "Compiling..." : "Generate After-Action Report"}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 font-medium">
            <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No incidents are currently in <strong>RESOLVED</strong> or <strong>CLOSED</strong> status. After-action reports can only be generated for concluded incidents.</span>
          </div>
        )}
      </div>

        {/* Reports List + Editor */}
        {reports.length > 0 && (
          <div className="grid grid-cols-12 gap-4">
            {/* Sidebar: Report List */}
            <div className="col-span-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">Reports</h3>
              {reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedReport(r);
                    setSections(parseSections(r.sectionsJson));
                    setEditingSection(null);
                    setDirty(false);
                  }}
                  className={`w-full text-left rounded-lg border p-3 transition ${
                    selectedReport?.id === r.id
                      ? "border-tide bg-tide/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink truncate">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${r.pdfGenerated ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.pdfGenerated ? "PDF READY" : "DRAFT"}
                    </span>
                    <span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Main: Section Editor */}
            <div className="col-span-9 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              {selectedReport && sections && (
                <>
                  {/* Report Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-ink">{selectedReport.title}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Created: {new Date(selectedReport.createdAt).toLocaleString()}
                        {selectedReport.generatedBy && ` · By ${selectedReport.generatedBy.fullName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedReport.pdfGenerated && selectedReport.fileUrl && (
                        <a
                          href={`/api/ngo-reports/${selectedReport.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview PDF
                        </a>
                      )}
                      {selectedReport.pdfGenerated && selectedReport.fileUrl && (
                        <a
                          href={`/api/ngo-reports/${selectedReport.id}/file`}
                          download
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PDF
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={handleGeneratePDF}
                          disabled={generatingPdf}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{generatingPdf ? "Generating..." : selectedReport.pdfGenerated ? "Regenerate PDF" : "Generate PDF"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Editable Sections */}
                  <div className="space-y-3">
                    {SECTION_META.map(({ key, label, rows }) => (
                      <div key={key} className="rounded-lg border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-tide">{label}</h4>
                          {isAdmin && (
                            editingSection === key ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSection(null);
                                    setDirty(false);
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveSection(key, sections[key])}
                                  disabled={saving}
                                  className="rounded-md bg-tide px-3 py-1 text-[10px] font-bold text-white hover:bg-tide/90 disabled:opacity-50"
                                >
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSection(key);
                                  setDirty(false);
                                }}
                                className="text-[10px] font-bold text-tide hover:underline"
                              >
                                Edit
                              </button>
                            )
                          )}
                        </div>
                        <div className="p-3">
                          {editingSection === key ? (
                            <textarea
                              value={sections[key]}
                              onChange={(e) => {
                                setSections({ ...sections, [key]: e.target.value });
                                setDirty(true);
                              }}
                              rows={rows}
                              className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono text-ink focus:border-tide focus:outline-none resize-y"
                              placeholder={`Enter ${label.toLowerCase()}...`}
                            />
                          ) : (
                            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                              {sections[key] || <span className="text-slate-400 italic">No data. Click "Edit" to add content.</span>}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {dirty && (
                    <div className="sticky bottom-0 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800 font-medium flex items-center justify-between">
                      <span>You have unsaved changes in "{editingSection}"</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSection(null);
                            setDirty(false);
                            setSections(parseSections(selectedReport.sectionsJson));
                          }}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => editingSection && void handleSaveSection(editingSection, sections[editingSection])}
                          disabled={saving}
                          className="rounded-md bg-amber-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {reports.length === 0 && selectedCrisisId && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">
              No after-action reports yet for this crisis.
            </p>
            {isAdmin ? (
              <p className="text-xs text-slate-400 mt-2">
                Click <strong className="text-tide">"Generate After-Action Report"</strong> above to create one. The report will be pre-populated with crisis data and editable before generating the final PDF.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                An admin must generate the after-action report for this crisis.
              </p>
            )}
          </div>
        )}
      </div>
  );
}
