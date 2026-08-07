import { useEffect, useState } from "react";
import { getCrisesForDropdownApi, getMyTimesheetApi, logTaskApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { TimesheetSummary, VolunteerTask } from "../types";

export function MyTimesheetPage() {
  const { user } = useAuth();
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
  const [dateOfTask, setDateOfTask] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  });
  const [crisisEventId, setCrisisEventId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const myTier = user?.trustTier ?? "REPORTER";
  const evidenceRequired = myTier === "REPORTER" || myTier === "TRAINEE";

  const fetchTimesheet = async () => {
    setIsLoading(true);
    try {
      const data = await getMyTimesheetApi();
      setTasks(data.tasks ?? []);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchTimesheet();
    getCrisesForDropdownApi()
      .then(res => { if (!cancelled) setCrises(res.crises ?? []); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (evidenceRequired && files.length === 0) {
      setError("Photo evidence is required for your trust tier. Please upload at least one proof image.");
      return;
    }

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
      // Reset form
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
    if (status === "VERIFIED") return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">VERIFIED</span>;
    if (status === "REJECTED") return <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">REJECTED</span>;
    return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">PENDING</span>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      
      {/* Signature Header Card Box */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tide">Volunteer Timesheet</span>
            <span className="rounded-md bg-tide/10 px-2 py-0.5 text-[10px] font-bold text-tide">Tier: {myTier}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-ink font-display">My Volunteer Impact Log</h1>
          <p className="mt-0.5 text-xs text-slate-500">Log your helping tasks, earn impact points, and climb the leaderboard.</p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "logs" ? "new" : "logs")}
          className="rounded-xl bg-tide px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-tide/90 shrink-0 flex items-center justify-center gap-1.5"
        >
          {activeTab === "logs" ? (
            <>
              <span>+</span>
              <span>Log New Task</span>
            </>
          ) : (
            <span>View My Logged Tasks</span>
          )}
        </button>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Points Earned</p>
          <p className="mt-2 text-3xl font-extrabold text-tide font-display">{summary.totalPoints}</p>
          <p className="mt-0.5 text-[10px] text-slate-400 font-medium">Climb the responder leaderboard</p>
        </div>

        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Verified Hours</p>
          <p className="mt-2 text-3xl font-extrabold text-ink font-display">{summary.totalVerifiedHours}h</p>
          <p className="mt-0.5 text-[10px] text-slate-400 font-medium">Admin &amp; peer verified labor</p>
        </div>

        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Badges Earned</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600 font-display">{summary.badges?.length || 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-400 font-medium">Trust &amp; achievement badges</p>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "logs"
              ? "bg-tide text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          My Logged Tasks ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "new"
              ? "bg-tide text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          + Log New Task
        </button>
      </div>

      {/* TAB 1: Task History List */}
      {activeTab === "logs" && (
        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-tide border-t-transparent"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-bold text-ink">No tasks logged yet.</p>
              <p className="text-xs text-slate-500">Start logging your volunteer contributions to earn points and badges.</p>
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className="mt-2 inline-flex items-center gap-1 rounded-xl bg-tide px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-tide/90"
              >
                + Log Your First Task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-[#0e7490]/40 hover:bg-white shadow-xs"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-ink text-base">{task.title}</h3>
                        {getStatusBadge(task.status)}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">{task.description}</p>
                      
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        <span className="rounded-md bg-tide/10 px-2 py-0.5 text-[10px] font-bold text-tide">
                          {task.category}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-medium">{new Date(task.dateOfTask).toLocaleDateString()}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-medium">{task.hoursSpent} hrs spent</span>
                      </div>
                    </div>

                    <div className="mt-2 sm:mt-0 sm:text-right shrink-0">
                      <p className="text-2xl font-extrabold text-tide font-display">+{task.pointsAwarded}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Points</p>
                    </div>
                  </div>

                  {task.status === "REJECTED" && task.rejectionReason && (
                    <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                      <span className="font-bold">Reason for rejection:</span> {task.rejectionReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Log New Task Form (Structured like ReportIncidentPage) */}
      {activeTab === "new" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Section 1: Task Information */}
          <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2">
              <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Task Information</span>
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Task Title *
                </label>
                <input
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Distributed water bottles and emergency medical kits"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Category *
                </label>
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
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

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Hours Spent *
                </label>
                <input
                  type="number"
                  required
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={hoursSpent}
                  onChange={(e) => setHoursSpent(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Date of Task *
                </label>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split("T")[0]}
                  value={dateOfTask}
                  onChange={(e) => setDateOfTask(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Linked Crisis Event (Optional)
                </label>
                <select
                  value={crisisEventId}
                  onChange={(e) => setCrisisEventId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                >
                  <option value="">-- None --</option>
                  {crises.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section 2: Detailed Description */}
          <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2">
              <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Work Description</span>
            </h2>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Activity Log *
              </label>
              <textarea
                required
                maxLength={500}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your actions, specific locations visited, and outcomes achieved..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
              />
            </div>
          </section>

          {/* Section 3: Supporting Evidence Upload (Styled like Report Incident) */}
          <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2">
                <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Supporting Photo Evidence</span>
              </h2>
              {evidenceRequired ? (
                <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Required for Tier: {myTier}</span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Optional for Tier: {myTier}</span>
              )}
            </div>

            <div>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const MAX_FILE_SIZE = 20 * 1024 * 1024;
                  const MAX_FILES = 2;
                  const selected = Array.from(e.target.files || []);
                  if (selected.length > MAX_FILES) {
                    alert(`Maximum ${MAX_FILES} files allowed.`);
                    return;
                  }
                  const oversized = selected.find(f => f.size > MAX_FILE_SIZE);
                  if (oversized) {
                    alert("Files must be 20MB or less.");
                    return;
                  }
                  setFiles(selected);
                }}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-tide file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-tide/90 cursor-pointer"
              />
              <p className={`mt-2 text-xs ${evidenceRequired ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                {evidenceRequired
                  ? "Photo evidence is mandatory for your trust tier to prevent fraud. Upload 1-2 proof photos."
                  : "Upload up to 2 proof images (JPG/PNG). Optional for your trust tier."}
              </p>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-tide px-8 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-tide/90 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting Task..." : "Submit Task for Verification"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
