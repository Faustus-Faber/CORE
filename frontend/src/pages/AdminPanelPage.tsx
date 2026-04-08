import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { approveReview, approveVolunteer, banVolunteer, deleteReview, getFlaggedReviews, getFlaggedVolunteers, listUsers, updateUserBanStatus, updateUserRole } from "../services/api";
import type { FlaggedVolunteer, Review } from "../types";

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

type Tab = "users" | "flagged-reviews" | "flagged-volunteers";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-amber-400" : "text-slate-300"}>
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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await listUsers();
      setUsers(response.users);
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
      setFlaggedReviews(response.reviews);
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
      setFlaggedVolunteers(response.volunteers);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load flagged volunteers"
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
    } else {
      void loadFlaggedVolunteers();
    }
  }, [activeTab]);

  const handleRoleChange = async (userId: string, role: "USER" | "VOLUNTEER") => {
    setMessage("");
    setError("");
    try {
      await updateUserRole(userId, role);
      setMessage("Role updated");
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update role");
    }
  };

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    setMessage("");
    setError("");
    try {
      await updateUserBanStatus(userId, isBanned);
      setMessage(isBanned ? "User banned" : "User unbanned");
      await loadUsers();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Could not update status"
      );
    }
  };

  const handleApproveReview = async (reviewId: string) => {
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
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
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
    }
  };

  const handleApproveVolunteer = async (volunteerId: string) => {
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
    }
  };

  const handleBanVolunteer = async (volunteerId: string) => {
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
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "Users" },
    {
      id: "flagged-reviews",
      label: `Flagged Reviews${flaggedReviews.length > 0 ? ` (${flaggedReviews.length})` : ""}`
    },
    {
      id: "flagged-volunteers",
      label: `Flagged Volunteers${flaggedVolunteers.length > 0 ? ` (${flaggedVolunteers.length})` : ""}`
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">Admin Panel</h1>
        <button
          type="button"
          onClick={() => navigate("/reports/review")}
          className="rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white hover:bg-tide/90"
        >
          Moderate Reports
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`admin-tab-${tab.id}`}
            type="button"
            onClick={() => {
              setMessage("");
              setError("");
              setActiveTab(tab.id);
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id
                ? "bg-white text-tide shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-ink"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* ── Users tab ── */}
      {activeTab === "users" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-panel ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading users…
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{user.fullName}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.phone}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">{user.isBanned ? "Banned" : "Active"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.role !== "ADMIN" && (
                          <select
                            value={user.role}
                            onChange={(event) =>
                              void handleRoleChange(
                                user.id,
                                event.target.value as "USER" | "VOLUNTEER"
                              )
                            }
                            className="rounded border border-slate-300 px-2 py-1"
                          >
                            <option value="USER">User</option>
                            <option value="VOLUNTEER">Volunteer</option>
                          </select>
                        )}
                        {user.role !== "ADMIN" && (
                          <button
                            type="button"
                            onClick={() => void handleBanToggle(user.id, !user.isBanned)}
                            className={`rounded px-3 py-1 font-semibold text-white ${user.isBanned ? "bg-moss" : "bg-ember"
                              }`}
                          >
                            {user.isBanned ? "Unban" : "Ban"}
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
      )}

      {/* ── Flagged Reviews tab ── */}
      {activeTab === "flagged-reviews" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-panel ring-1 ring-slate-200">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Loading flagged reviews…
            </p>
          ) : flaggedReviews.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No flagged reviews at this time. 🎉
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Volunteer</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Review Text</th>
                  <th className="px-4 py-3">Flag Reasons</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedReviews.map((review) => (
                  <tr key={review.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {review.reviewer?.fullName ?? "—"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {review.reviewer?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {review.volunteer?.fullName ?? "—"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {review.volunteer?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StarDisplay rating={review.rating} />
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="line-clamp-3 text-slate-700">{review.text}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="flex flex-col gap-1">
                        {review.flagReasons.map((reason) => (
                          <li
                            key={reason}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
                          >
                            ⚠ {reason}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {formatDate(review.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApproveReview(review.id)}
                          className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteReview(review.id)}
                          className="rounded bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Flagged Volunteers tab ── */}
      {activeTab === "flagged-volunteers" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-panel ring-1 ring-slate-200">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Loading flagged volunteers…
            </p>
          ) : flaggedVolunteers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No flagged volunteers at this time. 🎉
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Volunteer</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Flag Reasons</th>
                  <th className="px-4 py-3">Reviews Stats</th>
                  <th className="px-4 py-3">Date Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedVolunteers.map((volunteer) => {
                  const avgRating = volunteer.reviewsReceived.length > 0
                    ? volunteer.reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / volunteer.reviewsReceived.length
                    : 0;
                  const negativeReviewsCount = volunteer.reviewsReceived.filter(r => !r.wouldWorkAgain).length;

                  return (
                    <tr key={volunteer.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {volunteer.fullName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {volunteer.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {volunteer.location}
                      </td>
                      <td className="px-4 py-3">
                        <ul className="flex flex-col gap-1">
                          {volunteer.volunteerFlagReasons.map((reason) => (
                            <li
                              key={reason}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
                            >
                              ⚠ {reason}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">
                              {avgRating.toFixed(1)} ★
                            </span>
                            <span className="text-xs text-slate-500">
                              ({volunteer.reviewsReceived.length} reviews)
                            </span>
                          </div>
                          <div className="text-xs text-amber-600">
                            {negativeReviewsCount} "Would not work again"
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {formatDate(volunteer.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApproveVolunteer(volunteer.id)}
                            className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
                          >
                            Clear Flag
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBanVolunteer(volunteer.id)}
                            className="rounded bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700"
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
          )}
        </div>
      )}
    </div>
  );
}
