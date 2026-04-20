import { useEffect, useState } from "react";
import { getCrisesForDropdownApi, getMyTimesheetApi, logTaskApi } from "../services/api";
import type { TimesheetSummary, VolunteerTask } from "../types";

export function MyTimesheetPage() {
  const [activeTab, setActiveTab] = useState<"logs" | "new">("logs");
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary>({ totalPoints: 0, totalVerifiedHours: 0, badges: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [crises, setCrises] = useState<{ id: string; title: string }[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [hoursSpent, setHoursSpent] = useState(1);
  const [dateOfTask, setDateOfTask] = useState(new Date().toISOString().split("T")[0]);
  const [crisisEventId, setCrisisEventId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchTimesheet = async () => {
    setIsLoading(true);
    try {
      const data = await getMyTimesheetApi();
      setTasks(data.tasks);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheet();
    getCrisesForDropdownApi().then(res => setCrises(res.crises)).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await logTaskApi({
        title,
        description,
        category,
        hoursSpent,
        dateOfTask,
        crisisEventId: crisisEventId || null
      }, files);
      setActiveTab("logs");
      // reset form
      setTitle("");
      setDescription("");
      setCategory("OTHER");
      setHoursSpent(1);
      setDateOfTask(new Date().toISOString().split("T")[0]);
      setCrisisEventId("");
      setFiles([]);
      await fetchTimesheet();
    } catch (err: any) {
      setError(err.message || "Failed to log task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "VERIFIED") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>;
    if (status === "REJECTED") return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Rejected</span>;
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink">My Timesheet</h1>
        <p className="text-sm text-slate-500">Log your helping tasks, earn points, and climb the leaderboard.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Points</p>
          <p className="mt-1 text-3xl font-black text-tide">{summary.totalPoints}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Verified Hours</p>
          <p className="mt-1 text-3xl font-black text-ink">{summary.totalVerifiedHours}h</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Badges Earned</p>
          <p className="mt-1 text-3xl font-black text-ink">{summary.badges?.length || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("logs")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${
              activeTab === "logs" ? "border-tide text-tide" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            My Tasks
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${
              activeTab === "new" ? "border-tide text-tide" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Log New Task
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
        {activeTab === "logs" && (
          isLoading ? (
            <div className="text-center text-slate-500 py-8">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-slate-500 py-8">No tasks logged yet. Start logging your volunteer work!</div>
          ) : (
            <div className="space-y-4">
              {tasks.map(task => (
                <div key={task.id} className="rounded-lg border border-slate-100 p-4 transition hover:bg-slate-50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-ink">{task.title}</h3>
                        {getStatusBadge(task.status)}
                      </div>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{task.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {task.category}
                        </span>
                        <span>{new Date(task.dateOfTask).toLocaleDateString()}</span>
                        <span>{task.hoursSpent} hrs</span>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right shrink-0">
                      <p className="text-2xl font-black text-tide">+{task.pointsAwarded}</p>
                      <p className="text-xs text-slate-500">Points</p>
                    </div>
                  </div>
                  {task.status === "REJECTED" && task.rejectionReason && (
                    <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-100">
                      <span className="font-semibold">Reason for rejection:</span> {task.rejectionReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "new" && (
          <form onSubmit={handleSubmit} className="space-y-5 flex flex-col items-center">
            {error && (
              <div className="w-full rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}
            
            <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:w-3/4">
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-sm font-semibold text-ink">Task Title *</label>
                <input
                  required
                  maxLength={100}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g. Distributed water bottles in downtown"
                />
              </div>

              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-sm font-semibold text-ink">Task Description *</label>
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about the work you did..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">Category *</label>
                <select
                  required
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide bg-white"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="RESCUE">Rescue (3x points)</option>
                  <option value="MEDICAL_AID">Medical Aid (2.5x points)</option>
                  <option value="SUPPLY_DISTRIBUTION">Supply Distribution (2x points)</option>
                  <option value="SHELTER_SETUP">Shelter Setup (2x points)</option>
                  <option value="CLEANUP">Cleanup (1.5x points)</option>
                  <option value="COUNSELING">Counseling (2x points)</option>
                  <option value="TRANSPORTATION">Transportation (1.5x points)</option>
                  <option value="OTHER">Other (1x points)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">Hours Spent *</label>
                <input
                  type="number"
                  required
                  min={0.5}
                  max={24}
                  step={0.5}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                  value={hoursSpent}
                  onChange={(e) => setHoursSpent(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">Date of Task *</label>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide bg-white"
                  value={dateOfTask}
                  onChange={(e) => setDateOfTask(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">Linked Crisis Event (Optional)</label>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide bg-white"
                  value={crisisEventId}
                  onChange={(e) => setCrisisEventId(e.target.value)}
                >
                  <option value="">-- None --</option>
                  {crises.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-sm font-semibold text-ink">Supporting Evidence (Optional)</label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length > 2) {
                      alert("Maximum 2 files allowed.");
                      return;
                    }
                    setFiles(selected);
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-tide/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tide hover:file:bg-tide/20"
                />
                <p className="text-xs text-slate-400 mt-1">Upload up to 2 proof images (JPG/PNG)</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 rounded-lg bg-tide px-8 py-2.5 font-bold text-white transition hover:bg-tide/90 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
            >
              {isSubmitting ? "Submitting..." : "Submit Task for Verification"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
