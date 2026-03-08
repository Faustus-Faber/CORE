import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await loginUser({ identifier, password, rememberMe });

      if (user.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-ink">Login to CORE</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="space-y-1 text-sm font-medium">
          Email or Phone
          <input
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm font-medium">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me
        </label>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="font-semibold text-tide underline">
          Forgot Password?
        </Link>
        <Link to="/signup" className="font-semibold text-tide underline">
          Sign Up
        </Link>
      </div>
    </div>
  );
}
