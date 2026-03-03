import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { resetPassword } from "../services/api";

function useResetToken() {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") ?? "";
  }, [location.search]);
}

export function ResetPasswordPage() {
  const token = useResetToken();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      await resetPassword(token, password, confirmPassword);
      setMessage("Password has been reset. You can now login.");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-ink">Missing reset token</h1>
        <p className="mt-2 text-sm text-slate-700">
          Use the link from your email, or request a new reset link.
        </p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-semibold text-tide underline">
          Request Reset Link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-ink">Reset Password</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="space-y-1 text-sm font-medium">
          New Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Confirm New Password
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {message && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
        )}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Updating..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
