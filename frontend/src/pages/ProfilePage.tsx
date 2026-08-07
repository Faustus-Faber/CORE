import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { changePassword, getMyDispatchLogsApi, updateProfile } from "../services/api";
import { TrustTierCard } from "../components/TrustTierCard";
import type { AuthUser, DispatchAlertLog } from "../types";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: ""
};

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "tier" | "dispatch">("profile");
  const [profileForm, setProfileForm] = useState<Partial<AuthUser>>({});
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchAlertLog[]>([]);

  useEffect(() => {
    if (!user) return;

    setProfileForm({
      fullName: user.fullName,
      phone: user.phone,
      location: user.location,
      avatarUrl: user.avatarUrl ?? "",
      skills: user.skills,
      availability: user.availability ?? "",
      certifications: user.certifications ?? "",
      dispatchOptIn: user.dispatchOptIn ?? false
    });
  }, [user]);

  const isVolunteer = useMemo(() => user?.role === "VOLUNTEER", [user?.role]);

  useEffect(() => {
    let cancelled = false;
    if (isVolunteer) {
      getMyDispatchLogsApi()
        .then(res => { if (!cancelled) setDispatchLogs(res.logs ?? []); })
        .catch(console.error);
    }
    return () => { cancelled = true; };
  }, [isVolunteer]);

  if (!user) return null;

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (isSavingProfile) return;
    setError("");
    setProfileMessage("");
    setIsSavingProfile(true);

    try {
      const payload: Partial<AuthUser> = {
        fullName: profileForm.fullName,
        phone: profileForm.phone,
        location: profileForm.location,
        avatarUrl: profileForm.avatarUrl,
        dispatchOptIn: profileForm.dispatchOptIn
      };

      if (isVolunteer) {
        payload.skills = profileForm.skills;
        payload.availability = profileForm.availability;
        payload.certifications = profileForm.certifications;
      }

      const { profile } = await updateProfile(payload);
      setUser({ ...user, ...profile });
      setProfileMessage("Profile details updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (isSavingPassword) return;
    setError("");
    setPasswordMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(passwordForm.newPassword) || !/[a-z]/.test(passwordForm.newPassword) || !/[0-9]/.test(passwordForm.newPassword) || !/[^A-Za-z0-9]/.test(passwordForm.newPassword)) {
      setError("New password must contain uppercase, lowercase, number, and a symbol.");
      return;
    }

    setIsSavingPassword(true);

    try {
      await changePassword(passwordForm);
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Password updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not change password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      
      {/* Header Card Container Box */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tide">Account Operations</span>
            <span className="rounded-md bg-tide/10 px-2 py-0.5 text-[10px] font-bold text-tide">Role: {user.role}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-ink font-display">Account &amp; Security Settings</h1>
          <p className="mt-0.5 text-xs text-slate-500">Manage your personal information, security credentials, trust tier, and alert settings.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-tide text-xs font-bold text-white shadow-xs">
            {(user.fullName ?? "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink truncate max-w-[160px]">{user.fullName}</p>
            <p className="text-[10px] text-slate-500 truncate max-w-[160px] font-mono">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Segmented Tab Navigation with Inline Theme SVG Icons */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "profile"
              ? "bg-tide text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Personal Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "security"
              ? "bg-tide text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Security Credentials</span>
        </button>

        {isVolunteer && (
          <button
            type="button"
            onClick={() => setActiveTab("tier")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "tier"
                ? "bg-tide text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Trust Tier Status</span>
          </button>
        )}

        {isVolunteer && (
          <button
            type="button"
            onClick={() => setActiveTab("dispatch")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "dispatch"
                ? "bg-tide text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Dispatch Alerts ({dispatchLogs.length})</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: Personal Information Form ───────────────────────────────── */}
      {activeTab === "profile" && (
        <form onSubmit={submitProfile} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {profileMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
              {profileMessage}
            </div>
          )}

          {/* Section 1: Basic Identity */}
          <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2 border-b border-slate-100 pb-3">
              <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Contact &amp; Identity Details</span>
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Full Name *
                </label>
                <input
                  required
                  value={profileForm.fullName ?? ""}
                  onChange={(event) =>
                    setProfileForm((value) => ({ ...value, fullName: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Direct Phone Number *
                </label>
                <input
                  value={profileForm.phone ?? ""}
                  onChange={(event) =>
                    setProfileForm((value) => ({ ...value, phone: event.target.value }))
                  }
                  placeholder="e.g. +8801700000000"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Primary Base Location
                </label>
                <input
                  value={profileForm.location ?? ""}
                  onChange={(event) =>
                    setProfileForm((value) => ({ ...value, location: event.target.value }))
                  }
                  placeholder="e.g. Banani, Dhaka"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Avatar Image URL (Optional)
                </label>
                <input
                  value={profileForm.avatarUrl ?? ""}
                  onChange={(event) =>
                    setProfileForm((value) => ({ ...value, avatarUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Responder Qualifications (if volunteer) */}
          {isVolunteer && (
            <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2 border-b border-slate-100 pb-3">
                <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Responder Qualifications &amp; Preferences</span>
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Skills (Comma Separated)
                  </label>
                  <input
                    value={(profileForm.skills ?? []).join(", ")}
                    onChange={(event) =>
                      setProfileForm((value) => ({
                        ...value,
                        skills: event.target.value
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter(Boolean)
                      }))
                    }
                    placeholder="First Aid, Search & Rescue, CPR, Boat Piloting"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Availability Schedule
                  </label>
                  <input
                    value={profileForm.availability ?? ""}
                    onChange={(event) =>
                      setProfileForm((value) => ({ ...value, availability: event.target.value }))
                    }
                    placeholder="Weekends / Evenings / 24-7"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Certifications
                  </label>
                  <input
                    value={profileForm.certifications ?? ""}
                    onChange={(event) =>
                      setProfileForm((value) => ({
                        ...value,
                        certifications: event.target.value
                      }))
                    }
                    placeholder="Red Cross First Aid, EMT-B"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                  />
                </div>

                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(profileForm.dispatchOptIn)}
                      onChange={(event) =>
                        setProfileForm((value) => ({
                          ...value,
                          dispatchOptIn: event.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-tide focus:ring-tide"
                    />
                    Opt-in to automated Emergency Dispatch Email Alerts
                  </label>
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="rounded-xl bg-tide px-8 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-tide/90 active:scale-95 disabled:opacity-50"
            >
              {isSavingProfile ? "Saving Profile..." : "Save Profile Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ── TAB 2: Security Credentials Form ──────────────────────────────── */}
      {activeTab === "security" && (
        <form onSubmit={submitPassword} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {passwordMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
              {passwordMessage}
            </div>
          )}

          <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2 border-b border-slate-100 pb-3">
              <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Change Password</span>
            </h2>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((value) => ({ ...value, currentPassword: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((value) => ({ ...value, newPassword: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Must be at least 8 characters with uppercase, lowercase, number, and special symbol.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmNewPassword}
                  onChange={(event) =>
                    setPasswordForm((value) => ({
                      ...value,
                      confirmNewPassword: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
              </div>
            </div>

            {/* Prominent Card Footer Submit Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="rounded-xl bg-tide px-8 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-tide/90 active:scale-95 disabled:opacity-50"
              >
                {isSavingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          </section>
        </form>
      )}

      {/* ── TAB 3: Trust Tier Card ─────────────────────────────────────────── */}
      {activeTab === "tier" && isVolunteer && (
        <TrustTierCard trustTier={user?.trustTier} />
      )}

      {/* ── TAB 4: Dispatch Alerts History ─────────────────────────────────── */}
      {activeTab === "dispatch" && isVolunteer && (
        <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-tide flex items-center gap-2 border-b border-slate-100 pb-3">
            <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Emergency Dispatch Alert History</span>
          </h2>

          {dispatchLogs.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 p-6 rounded-lg border border-slate-200 text-center italic">
              No dispatch alerts received yet. Make sure your dispatch email alerts opt-in is enabled in Personal Information!
            </p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {dispatchLogs.map(log => (
                <div key={log.id} className="flex flex-col gap-1.5 p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink text-xs">
                      {log.crisisEvent?.title || "Emergency Dispatch Alert"}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      log.status === "SENT"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : log.status === "QUEUED"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between items-center font-mono">
                    <span>Target: {log.emailMasked}</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.errorMessage && (
                    <div className="text-[11px] text-rose-600 mt-0.5 italic">
                      Error: {log.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
