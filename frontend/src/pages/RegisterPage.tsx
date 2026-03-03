import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "../services/api";

type RegisterForm = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  location: string;
  role: "USER" | "VOLUNTEER";
  skills: string;
  availability: string;
  certifications: string;
};

const initialForm: RegisterForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  location: "",
  role: "USER",
  skills: "",
  availability: "",
  certifications: ""
};

export function RegisterPage() {
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const isVolunteer = useMemo(() => form.role === "VOLUNTEER", [form.role]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await registerUser({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        location: form.location,
        role: form.role,
        skills: isVolunteer
          ? form.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean)
          : undefined,
        availability: isVolunteer ? form.availability : undefined,
        certifications: isVolunteer ? form.certifications : undefined
      });

      setSuccess("Registration complete. Redirecting to login...");
      setTimeout(() => navigate("/login"), 900);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Registration failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-ink">Create an account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sign up as a User or Volunteer. Admin accounts are seeded by deployment only.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Full Name
            <input
              required
              value={form.fullName}
              onChange={(event) =>
                setForm((value) => ({ ...value, fullName: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm((value) => ({ ...value, email: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Phone
            <input
              required
              placeholder="+8801712345678"
              value={form.phone}
              onChange={(event) =>
                setForm((value) => ({ ...value, phone: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <span className="block text-xs text-slate-500">
              Use 10-15 digits. `+` is allowed.
            </span>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Location / Area
            <input
              required
              value={form.location}
              onChange={(event) =>
                setForm((value) => ({ ...value, location: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) =>
                setForm((value) => ({ ...value, password: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <span className="block text-xs text-slate-500">
              Minimum 8 chars with uppercase, lowercase, number, and symbol.
            </span>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Confirm Password
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((value) => ({ ...value, confirmPassword: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm font-medium">
          Role
          <select
            value={form.role}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                role: event.target.value as "USER" | "VOLUNTEER"
              }))
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="USER">User</option>
            <option value="VOLUNTEER">Volunteer</option>
          </select>
        </label>

        {isVolunteer && (
          <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium md:col-span-2">
              Skills / Specializations (comma separated)
              <input
                required
                value={form.skills}
                onChange={(event) =>
                  setForm((value) => ({ ...value, skills: event.target.value }))
                }
                placeholder="First Aid, Search & Rescue"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Availability Schedule
              <input
                required
                value={form.availability}
                onChange={(event) =>
                  setForm((value) => ({ ...value, availability: event.target.value }))
                }
                placeholder="Weekdays evenings"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Prior Certifications (optional)
              <input
                value={form.certifications}
                onChange={(event) =>
                  setForm((value) => ({ ...value, certifications: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-700">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-tide underline">
          Login
        </Link>
      </p>
    </div>
  );
}
