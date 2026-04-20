import { useState, useEffect } from "react";
import { 
  generateNGOReport, 
  listNGOReports, 
  NGOReport,
  listVolunteers,
  NGOReportResource
} from "../services/api";
import { AuthUser } from "../types";

type NGOReportSectionProps = {
  crisisEventId: string;
  status: string;
  isAdmin: boolean;
};

export function NGOReportSection({ crisisEventId, status, isAdmin }: NGOReportSectionProps) {
  const [reports, setReports] = useState<NGOReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [allVolunteers, setAllVolunteers] = useState<AuthUser[]>([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [manualResources, setManualResources] = useState<NGOReportResource[]>([{ name: "", amount: "" }]);

  const canGenerate = status === "RESOLVED" || status === "CLOSED";

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await listNGOReports(crisisEventId);
      setReports(data);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVolunteers = async () => {
    try {
      const { volunteers } = await listVolunteers();
      setAllVolunteers(volunteers);
    } catch (err) {
      console.error("Failed to load volunteers", err);
    }
  };

  useEffect(() => {
    void fetchReports();
    if (isAdmin) {
      void fetchVolunteers();
    }
  }, [crisisEventId, isAdmin]);

  const handleAddResource = () => {
    setManualResources([...manualResources, { name: "", amount: "" }]);
  };

  const handleResourceChange = (index: number, field: keyof NGOReportResource, value: string) => {
    const updated = [...manualResources];
    updated[index][field] = value;
    setManualResources(updated);
  };

  const handleVolunteerToggle = (volunteerId: string) => {
    if (selectedVolunteers.includes(volunteerId)) {
      setSelectedVolunteers(selectedVolunteers.filter(id => id !== volunteerId));
    } else {
      setSelectedVolunteers([...selectedVolunteers, volunteerId]);
    }
  };

  const handleGenerate = async () => {
    if (!window.confirm("Are you sure you want to generate a new NGO Summary Report with the provided details?")) return;
    setGenerating(true);
    try {
      // Filter out empty resources
      const filteredResources = manualResources.filter(r => r.name.trim() !== "");
      
      const newReport = await generateNGOReport(crisisEventId, {
        assignedVolunteers: selectedVolunteers,
        resources: filteredResources
      });
      setReports([newReport, ...reports]);
      setShowForm(false);
      // Reset form
      setSelectedVolunteers([]);
      setManualResources([{ name: "", amount: "" }]);
      // Open in new tab for preview
      window.open(newReport.fileUrl, "_blank");
    } catch (err) {
      alert("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">NGO Summary Reports</h2>
        <div className="flex gap-2">
          {canGenerate && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              disabled={generating}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Prepare NGO Report
            </button>
          )}
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {showArchive ? "Hide Archive" : `View Archive (${reports.length})`}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">New Report Details</h3>
            <button 
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">
              Assigned Volunteers
            </label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allVolunteers.map(v => (
                <label key={v.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={selectedVolunteers.includes(v.id)}
                    onChange={() => handleVolunteerToggle(v.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-700">{v.fullName}</span>
                </label>
              ))}
              {allVolunteers.length === 0 && (
                <p className="text-xs text-slate-400 col-span-2 text-center py-2">No volunteers found in registry.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">
                Used Resources
              </label>
              <button 
                onClick={handleAddResource}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase"
              >
                + Add Resource
              </button>
            </div>
            <div className="space-y-2">
              {manualResources.map((res, idx) => (
                <div key={idx} className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Resource Name (e.g. Water)"
                    value={res.name}
                    onChange={(e) => handleResourceChange(idx, "name", e.target.value)}
                    className="flex-1 rounded-lg border-slate-200 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <input 
                    type="text"
                    placeholder="Amount (e.g. 500L)"
                    value={res.amount}
                    onChange={(e) => handleResourceChange(idx, "amount", e.target.value)}
                    className="w-32 rounded-lg border-slate-200 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating Report..." : "Generate Final NGO Report"}
          </button>
        </div>
      )}

      {showArchive && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {loading ? (
            <p className="text-center text-xs text-slate-500">Loading archive...</p>
          ) : reports.length === 0 ? (
            <p className="text-center text-xs text-slate-500">No reports generated yet.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((report) => (
                <li key={report.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-ink">{report.title}</p>
                    <p className="text-[10px] text-slate-500">
                      Generated on {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={report.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-tide hover:underline"
                    >
                      Preview
                    </a>
                    <a
                      href={report.fileUrl}
                      download
                      className="text-xs font-semibold text-tide hover:underline"
                    >
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
