import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { changePassword, updateProfile } from "../services/api";
import type { AuthUser } from "../types";

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
    </div>
  );
}
