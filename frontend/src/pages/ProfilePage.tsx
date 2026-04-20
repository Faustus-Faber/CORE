import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { changePassword, getMySmsLogsApi, updateProfile } from "../services/api";
import type { AuthUser, SmsLog } from "../types";

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
  const [profileForm, setProfileForm] = useState<Partial<AuthUser>>({});
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

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
    if (isVolunteer) {
      getMySmsLogsApi()
        .then(res => setSmsLogs(res.logs))
        .catch(console.error);
    }
  }, [isVolunteer]);

  if (!user) {
    return null;
  }

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
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
      setProfileMessage("Profile updated successfully");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setPasswordMessage("");
    setIsSavingPassword(true);

    try {
      await changePassword(passwordForm);
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Password changed successfully");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not change password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <form onSubmit={submitProfile} className="mt-5 space-y-3">
          <label className="space-y-1 text-sm font-medium">
            Name
            <input
              value={profileForm.fullName ?? ""}
              onChange={(event) =>
                setProfileForm((value) => ({ ...value, fullName: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Phone
            <input
              value={profileForm.phone ?? ""}
              onChange={(event) =>
                setProfileForm((value) => ({ ...value, phone: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Location
            <input
              value={profileForm.location ?? ""}
              onChange={(event) =>
                setProfileForm((value) => ({ ...value, location: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Avatar URL
            <input
              value={profileForm.avatarUrl ?? ""}
              onChange={(event) =>
                setProfileForm((value) => ({ ...value, avatarUrl: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          {isVolunteer && (
            <>
              <label className="space-y-1 text-sm font-medium">
                Skills (comma separated)
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Availability
                <input
                  value={profileForm.availability ?? ""}
                  onChange={(event) =>
                    setProfileForm((value) => ({ ...value, availability: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Certifications
                <input
                  value={profileForm.certifications ?? ""}
                  onChange={(event) =>
                    setProfileForm((value) => ({
                      ...value,
                      certifications: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(profileForm.dispatchOptIn)}
                  onChange={(event) =>
                    setProfileForm((value) => ({
                      ...value,
                      dispatchOptIn: event.target.checked
                    }))
                  }
                />
                Dispatch SMS opt-in
              </label>
            </>
          )}

          {profileMessage && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {profileMessage}
            </p>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={isSavingProfile}
            className="w-full rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-ink">Change Password</h2>
        <form onSubmit={submitPassword} className="mt-5 space-y-3">
          <label className="space-y-1 text-sm font-medium">
            Current Password
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((value) => ({ ...value, currentPassword: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            New Password
            <input
              type="password"
              required
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((value) => ({ ...value, newPassword: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Confirm New Password
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
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          {passwordMessage && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {passwordMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={isSavingPassword}
            className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSavingPassword ? "Updating..." : "Change Password"}
          </button>
        </form>
      </section>

      {isVolunteer && (
        <section className="md:col-span-2 rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-2xl font-bold text-ink mb-4 flex items-center gap-2">
            <svg className="h-6 w-6 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            My Alerts
          </h2>
          {smsLogs.length === 0 ? (
            <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
              No dispatch alerts received yet. Make sure you opt in using the bell icon!
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {smsLogs.map(log => (
                <div key={log.id} className="flex flex-col gap-1 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink text-sm">
                      {log.crisisEvent?.title || "Unknown Emergency"}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      log.status === "SENT" || log.status === "DELIVERED" 
                        ? "bg-emerald-100 text-emerald-700" 
                        : "bg-red-100 text-red-700"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between items-center">
                    <span>To: {log.phoneMasked}</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.errorMessage && (
                    <div className="text-xs text-red-600 mt-1 italic">
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
