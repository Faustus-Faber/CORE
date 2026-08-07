import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { approveReview, approveVolunteer, banVolunteer, deleteReview, getFlaggedReviews, getFlaggedVolunteers, listUsers, updateUserBanStatus, updateUserRole, getPendingTasksApi, verifyTaskApi, getUnresolvedConflicts, resolveConflict, getTrustTierVolunteersApi, suspendResponder, reinstateResponder, type ConflictResolutionEntry } from "../services/api";
import type { FlaggedVolunteer, Review, VolunteerTask, TrustTierVolunteer } from "../types";
import { TrustTierBadge } from "../components/TrustTierBadge";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "/api").replace("/api", "") || "";

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  role: "USER" | "VOLUNTEER" | "ADMIN";
  isBanned: boolean;
  createdAt: string;
};

type Tab = "users" | "flagged-reviews" | "flagged-volunteers" | "task-verification" | "trust-tiers" | "conflicts";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-amber-400 font-bold" : "text-slate-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function AdminPanelPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [flaggedReviews, setFlaggedReviews] = useState<Review[]>([]);
  const [flaggedVolunteers, setFlaggedVolunteers] = useState<FlaggedVolunteer[]>([]);
  const [pendingTasks, setPendingTasks] = useState<VolunteerTask[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolutionEntry[]>([]);
  const [trustTierVolunteers, setTrustTierVolunteers] = useState<TrustTierVolunteer[]>([]);
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string>("");

  const loadUsers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await listUsers();
      setUsers(response.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFlaggedReviews = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getFlaggedReviews();
      setFlaggedReviews(response.reviews ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load flagged reviews"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadFlaggedVolunteers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getFlaggedVolunteers();
      setFlaggedVolunteers(response.volunteers ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load flagged volunteers"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingTasks = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getPendingTasksApi();
      setPendingTasks(response.tasks ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load pending tasks"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadConflicts = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getUnresolvedConflicts();
      setConflicts(response.conflicts ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load conflicts"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrustTiers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getTrustTierVolunteersApi();
      setTrustTierVolunteers(response.volunteers ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load trust tier data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers();
    } else if (activeTab === "flagged-reviews") {
      void loadFlaggedReviews();
    } else if (activeTab === "flagged-volunteers") {
      void loadFlaggedVolunteers();
    } else if (activeTab === "task-verification") {
      void loadPendingTasks();
    } else if (activeTab === "conflicts") {
      void loadConflicts();
    } else if (activeTab === "trust-tiers") {
      void loadTrustTiers();
    }
  }, [activeTab]);

  const handleRoleChange = async (userId: string, newRole: "USER" | "VOLUNTEER") => {
    const actionKey = `role-${userId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await updateUserRole(userId, newRole);
      setMessage(`User role updated to ${newRole}`);
      await loadUsers();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Could not update role"
      );
    } finally {
      setPendingAction("");
    }
  };

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    const actionKey = `ban-${userId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await updateUserBanStatus(userId, isBanned);
      setMessage(isBanned ? "User account banned" : "User account reinstated");
      await loadUsers();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Could not update ban status"
      );
    } finally {
      setPendingAction("");
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    const actionKey = `approve-review-${reviewId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await approveReview(reviewId);
      setMessage("Review approved");
      await loadFlaggedReviews();
    } catch (approveError) {
      setError(
        approveError instanceof Error ? approveError.message : "Could not approve review"
      );
    } finally {
      setPendingAction("");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this review? This action cannot be undone.")) return;
    const actionKey = `delete-review-${reviewId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await deleteReview(reviewId);
      setMessage("Review deleted");
      await loadFlaggedReviews();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete review"
      );
    } finally {
      setPendingAction("");
    }
  };

  const handleApproveVolunteer = async (volunteerId: string) => {
    const actionKey = `approve-vol-${volunteerId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await approveVolunteer(volunteerId);
      setMessage("Volunteer flag cleared");
      await loadFlaggedVolunteers();
    } catch (approveError) {
      setError(
        approveError instanceof Error ? approveError.message : "Could not clear volunteer flag"
      );
    } finally {
      setPendingAction("");
    }
  };

  const handleBanVolunteer = async (volunteerId: string) => {
    if (!window.confirm("Are you sure you want to ban this volunteer? This action cannot be undone.")) return;
    const actionKey = `ban-vol-${volunteerId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await banVolunteer(volunteerId);
      setMessage("Volunteer banned");
      await loadFlaggedVolunteers();
    } catch (banError) {
      setError(
        banError instanceof Error ? banError.message : "Could not ban volunteer"
      );
    } finally {
      setPendingAction("");
    }
  };

  const handleVerifyTask = async (taskId: string, decision: "VERIFIED" | "REJECTED", reason?: string) => {
    const actionKey = `verify-${taskId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      const { pointsAwarded } = await verifyTaskApi(taskId, decision, reason);
      setMessage(`Task ${decision.toLowerCase()} ${decision === "VERIFIED" ? `(+${pointsAwarded} pts)` : ""}`);
      await loadPendingTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify task");
    } finally {
      setPendingAction("");
    }
  };

  const handleResolveConflict = async (conflictId: string, acceptedUpdateId: string) => {
    const actionKey = `conflict-${conflictId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await resolveConflict(conflictId, acceptedUpdateId);
      setMessage("Conflict resolved");
      await loadConflicts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve conflict");
    } finally {
      setPendingAction("");
    }
  };

  const handleSuspendResponder = async (userId: string, fullName: string) => {
    if (pendingAction) return;
    if (!window.confirm(`Suspend ${fullName}? This will demote them to REPORTER and strip their responder powers.`)) return;
    const actionKey = `suspend-${userId}`;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await suspendResponder(userId);
      setMessage(`${fullName} has been suspended and demoted to REPORTER.`);
      await loadTrustTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suspend responder");
    } finally {
      setPendingAction("");
    }
  };

  const handleReinstateResponder = async (userId: string, fullName: string) => {
    if (pendingAction) return;
    if (!window.confirm(`Reinstate ${fullName}? Their trust tier will be re-evaluated based on current stats.`)) return;
    const actionKey = `reinstate-${userId}`;
    setPendingAction(actionKey);
    setMessage("");
    setError("");
    try {
      await reinstateResponder(userId);
      setMessage(`${fullName} has been reinstated. Trust tier re-evaluated.`);
      await loadTrustTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reinstate responder");
    } finally {
      setPendingAction("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      
      {/* Signature Header Card Box */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tide">Command Console</span>
            <span className="rounded-md bg-tide/10 px-2 py-0.5 text-[10px] font-bold text-tide">Role: ADMIN</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-ink font-display">System Administration &amp; Governance</h1>
          <p className="mt-0.5 text-xs text-slate-500">User role management, content moderation queues, task verification, and AI conflict resolution.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/verification-queue")}
          className="rounded-xl bg-tide px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-tide/90 active:scale-95 shrink-0 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Verification Queue</span>
        </button>
      </div>

      {/* Segmented Tab Navigation with Theme SVG Icons */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => { setMessage(""); setError(""); setActiveTab("users"); }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "users" ? "bg-tide text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>Users</span>
        </button>

        <button
          type="button"
          onClick={() => { setMessage(""); setError(""); setActiveTab("flagged-reviews"); }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "flagged-reviews" ? "bg-tide text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          <span>Flagged Reviews {flaggedReviews.length > 0 && `(${flaggedReviews.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => { setMessage(""); setError(""); setActiveTab("flagged-volunteers"); }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "flagged-volunteers" ? "bg-tide text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Flagged Volunteers {flaggedVolunteers.length > 0 && `(${flaggedVolunteers.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => { setMessage(""); setError(""); setActiveTab("task-verification"); }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "task-verification" ? "bg-tide text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Task Verification {pendingTasks.length > 0 && `(${pendingTasks.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => { setMessage(""); setError(""); setActiveTab("trust-tiers"); }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "trust-tiers" ? "bg-tide text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Trust Tiers</span>
        </button>

        <button
          type="button"
          onClick={() => { setMessage(""); setError(""); setActiveTab("conflicts"); }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === "conflicts" ? "bg-tide text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Update Conflicts {conflicts.length > 0 && `(${conflicts.length})`}</span>
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* ── TAB 1: Users Table ─────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="rounded-xl border border-[#0e7490]/30 bg-white shadow-panel ring-1 ring-[#0e7490]/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">User Name</th>
                  <th className="px-5 py-3.5">Email Address</th>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">System Role</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500 italic">
                      Loading user database…
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-ink">{u.fullName}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono">{u.email}</td>
                      <td className="px-5 py-3.5 text-slate-600">{u.phone || "—"}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">{u.role}</td>
                      <td className="px-5 py-3.5">
                        {u.isBanned ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Banned
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.role !== "ADMIN" && (
                            <select
                              value={u.role}
                              disabled={!!pendingAction}
                              onChange={(event) =>
                                void handleRoleChange(
                                  u.id,
                                  event.target.value as "USER" | "VOLUNTEER"
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                            >
                              <option value="USER">User</option>
                              <option value="VOLUNTEER">Volunteer</option>
                            </select>
                          )}
                          {u.role !== "ADMIN" && (
                            <button
                              type="button"
                              disabled={!!pendingAction}
                              onClick={() => void handleBanToggle(u.id, !u.isBanned)}
                              className={`rounded-lg px-3.5 py-1 text-xs font-bold text-white shadow-xs transition ${
                                u.isBanned ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                              }`}
                            >
                              {u.isBanned ? "Reinstate" : "Ban"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Flagged Reviews ─────────────────────────────────────────── */}
      {activeTab === "flagged-reviews" && (
        <div className="rounded-xl border border-[#0e7490]/30 bg-white shadow-panel ring-1 ring-[#0e7490]/20 overflow-hidden">
          {isLoading ? (
            <p className="px-6 py-8 text-center text-xs text-slate-500 italic">
              Loading flagged reviews…
            </p>
          ) : flaggedReviews.length === 0 ? (
            <p className="px-6 py-8 text-center text-xs text-slate-500 italic">
              No flagged reviews pending moderation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-5 py-3.5">Reviewer</th>
                    <th className="px-5 py-3.5">Target Volunteer</th>
                    <th className="px-5 py-3.5">Rating</th>
                    <th className="px-5 py-3.5">Review Content</th>
                    <th className="px-5 py-3.5">Flag Reasons</th>
                    <th className="px-5 py-3.5">Submitted</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flaggedReviews.map((review) => (
                    <tr key={review.id} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-ink">{review.reviewer?.fullName ?? "—"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{review.reviewer?.email ?? ""}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-ink">{review.volunteer?.fullName ?? "—"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{review.volunteer?.email ?? ""}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StarDisplay rating={review.rating} />
                      </td>
                      <td className="max-w-xs px-5 py-3.5 text-slate-700">
                        <p className="line-clamp-3 leading-relaxed">{review.text}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          {review.flagReasons.map((reason) => (
                            <span
                              key={reason}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 font-mono">
                        {formatDate(review.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!!pendingAction}
                            onClick={() => void handleApproveReview(review.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={!!pendingAction}
                            onClick={() => void handleDeleteReview(review.id)}
                            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Flagged Volunteers ──────────────────────────────────────── */}
      {activeTab === "flagged-volunteers" && (
        <div className="rounded-xl border border-[#0e7490]/30 bg-white shadow-panel ring-1 ring-[#0e7490]/20 overflow-hidden">
          {isLoading ? (
            <p className="px-6 py-8 text-center text-xs text-slate-500 italic">
              Loading flagged volunteers…
            </p>
          ) : flaggedVolunteers.length === 0 ? (
            <p className="px-6 py-8 text-center text-xs text-slate-500 italic">
              No flagged volunteers pending review.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-5 py-3.5">Volunteer</th>
                    <th className="px-5 py-3.5">Location</th>
                    <th className="px-5 py-3.5">Flag Reasons</th>
                    <th className="px-5 py-3.5">Review Stats</th>
                    <th className="px-5 py-3.5">Date Joined</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flaggedVolunteers.map((volunteer) => {
                    const reviews = volunteer.reviewsReceived ?? [];
                    const avgRating = reviews.length > 0
                      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                      : 0;
                    const negativeReviewsCount = reviews.filter(r => !r.wouldWorkAgain).length;

                    return (
                      <tr key={volunteer.id} className="hover:bg-slate-50/70 transition-colors align-top">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-ink">{volunteer.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{volunteer.email}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">{volunteer.location || "—"}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            {volunteer.volunteerFlagReasons.map((reason) => (
                              <span
                                key={reason}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            <div className="font-bold text-ink">{avgRating.toFixed(1)} ★ <span className="text-[10px] text-slate-400 font-normal">({reviews.length} reviews)</span></div>
                            <div className="text-[10px] text-amber-600 font-semibold">{negativeReviewsCount} negative feedback</div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-400 font-mono">
                          {formatDate(volunteer.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!!pendingAction}
                              onClick={() => void handleApproveVolunteer(volunteer.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                            >
                              Clear Flag
                            </button>
                            <button
                              type="button"
                              disabled={!!pendingAction}
                              onClick={() => void handleBanVolunteer(volunteer.id)}
                              className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700"
                            >
                              Ban Volunteer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Task Verification Cards ─────────────────────────────────── */}
      {activeTab === "task-verification" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl border border-[#0e7490]/30 bg-white p-8 shadow-panel ring-1 ring-[#0e7490]/20 text-center text-xs text-slate-500 italic">
              Loading pending tasks…
            </div>
          ) : pendingTasks.length === 0 ? (
            <div className="rounded-xl border border-[#0e7490]/30 bg-white p-8 shadow-panel ring-1 ring-[#0e7490]/20 text-center text-xs text-slate-500 italic">
              No volunteer tasks pending verification.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pendingTasks.map(task => (
                <div key={task.id} className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink text-sm">{task.title}</h3>
                        <p className="text-xs text-slate-500">by <span className="font-bold text-slate-700">{task.volunteer?.fullName}</span></p>
                      </div>
                      <span className="rounded-md bg-tide/10 px-2 py-0.5 text-[10px] font-bold text-tide whitespace-nowrap">
                        {task.category}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed italic">
                      "{task.description}"
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Date</span>
                        {formatDate(task.dateOfTask)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Hours Spent</span>
                        {task.hoursSpent} hrs
                      </div>
                      {task.evidenceUrls && task.evidenceUrls.length > 0 && (
                        <div className="w-full mt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Supporting Photo Evidence</span>
                          <div className="flex gap-2">
                            {task.evidenceUrls.map(url => (
                              <img key={url} src={`${API_ORIGIN}/uploads/${url}`} alt="Evidence" loading="lazy" decoding="async" className="h-16 w-24 rounded-lg object-cover border border-slate-200 shadow-xs" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex gap-2">
                    <button
                      disabled={!!pendingAction}
                      onClick={() => void handleVerifyTask(task.id, "VERIFIED")}
                      className="flex-1 rounded-xl bg-tide px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-tide/90 active:scale-95 disabled:opacity-50"
                    >
                      Verify Task ✓
                    </button>
                    <button
                      disabled={!!pendingAction}
                      onClick={() => {
                        const reason = prompt("Enter a reason for rejection (optional):");
                        if (reason !== null) {
                          void handleVerifyTask(task.id, "REJECTED", reason);
                        }
                      }}
                      className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-95 disabled:opacity-50"
                    >
                      Reject ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: Trust Tiers Distribution ───────────────────────────────── */}
      {activeTab === "trust-tiers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["REPORTER", "TRAINEE", "RESPONDER", "VETERAN"] as const).map((tier) => {
              const count = trustTierVolunteers.filter((v) => v.trustTier === tier).length;
              return (
                <div key={tier} className="rounded-xl border border-[#0e7490]/30 bg-white p-4 text-center shadow-panel ring-1 ring-[#0e7490]/20">
                  <p className="text-2xl font-extrabold text-ink font-display">{count}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{tier}</p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            {["ALL", "REPORTER", "TRAINEE", "RESPONDER", "VETERAN"].map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setTierFilter(tier)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  tierFilter === tier
                    ? "bg-tide text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tier === "ALL" ? "All Tiers" : tier}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#0e7490]/30 bg-white shadow-panel ring-1 ring-[#0e7490]/20 overflow-hidden">
            {isLoading ? (
              <p className="px-6 py-8 text-center text-xs text-slate-500 italic">Loading trust tier data…</p>
            ) : trustTierVolunteers.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-slate-500 italic">No volunteers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-5 py-3.5">Volunteer</th>
                      <th className="px-5 py-3.5">Tier</th>
                      <th className="px-5 py-3.5">Points</th>
                      <th className="px-5 py-3.5">Hours</th>
                      <th className="px-5 py-3.5">Reports</th>
                      <th className="px-5 py-3.5">Obs.</th>
                      <th className="px-5 py-3.5">Vouches</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trustTierVolunteers
                      .filter((v) => tierFilter === "ALL" || v.trustTier === tierFilter)
                      .map((volunteer) => (
                        <tr key={volunteer.id} className="hover:bg-slate-50/70 transition-colors align-top">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-ink">{volunteer.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{volunteer.email}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <TrustTierBadge tier={volunteer.trustTier} />
                          </td>
                          <td className="px-5 py-3.5 font-bold text-tide">{volunteer.totalPoints}</td>
                          <td className="px-5 py-3.5 text-slate-700 font-semibold">{volunteer.totalVerifiedHours}h</td>
                          <td className="px-5 py-3.5 text-slate-700">{volunteer.verifiedReportCount}</td>
                          <td className="px-5 py-3.5 text-slate-700">{volunteer.approvedObservationCount}</td>
                          <td className="px-5 py-3.5 text-slate-700">
                            {volunteer.vouchesReceivedCount > 0 ? (
                              <span className="text-emerald-600 font-bold">{volunteer.vouchesReceivedCount} rec</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
            {volunteer.responderStatus === "SUSPENDED" ? (
                              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">Suspended</span>
                            ) : volunteer.isFlagged ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">Flagged</span>
                            ) : (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">Active</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/volunteers/${volunteer.id}`)}
                                className="rounded-md border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                              >
                                View Profile
                              </button>
                              {volunteer.responderStatus === "SUSPENDED" ? (
                                <button
                                  type="button"
                                  disabled={!!pendingAction}
                                  onClick={() => void handleReinstateResponder(volunteer.id, volunteer.fullName)}
                                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Reinstate
                                </button>
                              ) : volunteer.responderStatus === "APPROVED" ? (
                                <button
                                  type="button"
                                  disabled={!!pendingAction}
                                  onClick={() => void handleSuspendResponder(volunteer.id, volunteer.fullName)}
                                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  Suspend
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: AI Update Conflicts ──────────────────────────────────────── */}
      {activeTab === "conflicts" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl border border-[#0e7490]/30 bg-white p-8 shadow-panel ring-1 ring-[#0e7490]/20 text-center text-xs text-slate-500 italic">
              Loading unresolved conflicts…
            </div>
          ) : conflicts.length === 0 ? (
            <div className="rounded-xl border border-[#0e7490]/30 bg-white p-8 shadow-panel ring-1 ring-[#0e7490]/20 text-center text-xs text-slate-500 italic">
              No unresolved crisis update conflicts.
            </div>
          ) : (
            conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-ink text-sm">{conflict.crisisTitle}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Logged {new Date(conflict.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-tide/10 px-3 py-1 text-[10px] font-bold text-tide border border-tide/20">
                    AI Analyzed Conflict
                  </span>
                </div>

                <div className="rounded-xl border border-cyan-200 bg-tide/5 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>AI Reconciliation Recommendation</span>
                  </p>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">{conflict.recommendation}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Conflicting Telemetry Submissions ({conflict.updateIds.length})
                  </p>
                  <div className="space-y-2">
                    {conflict.updateIds.map((updateId) => (
                      <div
                        key={updateId}
                        className={`flex items-center justify-between rounded-lg border p-3.5 transition-all ${
                          updateId === conflict.recommendedUpdateId
                            ? "border-emerald-300 bg-emerald-50/70 shadow-xs"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-700">
                            Update ID: {updateId.slice(-8)}
                          </span>
                          {updateId === conflict.recommendedUpdateId && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              RECOMMENDED BY AI
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!!pendingAction}
                          onClick={() => void handleResolveConflict(conflict.id, updateId)}
                          className="rounded-lg bg-tide px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-tide/90 active:scale-95 disabled:opacity-50"
                        >
                          Accept Update
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
