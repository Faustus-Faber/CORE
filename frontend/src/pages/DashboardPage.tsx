import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

function getRoleSummary(role: "USER" | "VOLUNTEER" | "ADMIN") {
  switch (role) {
    case "ADMIN":
      return "Admin Panel access, moderation tools, and NGO report controls are enabled.";
    case "VOLUNTEER":
      return "Volunteer dashboard includes task log, dispatch opt-in, and leaderboard access.";
    default:
      return "Community dashboard access is enabled for incident reporting and resource coordination.";
  }
}

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-ink">Welcome, {user.fullName}</h1>
        <p className="mt-2 text-slate-700">{getRoleSummary(user.role)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/report-incident"
            className="inline-flex rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white"
          >
            Submit New Incident
          </Link>
          <Link
            to="/reports/explore"
            className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse Reports
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-ink">Active Alerts</h2>
          <p className="mt-3 text-3xl font-bold text-ember">4</p>
        </article>
        <article className="rounded-lg bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-ink">Nearby Resources</h2>
          <p className="mt-3 text-3xl font-bold text-tide">12</p>
        </article>
        <article className="rounded-lg bg-white p-5 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-ink">Unread Notifications</h2>
          <p className="mt-3 text-3xl font-bold text-moss">3</p>
        </article>
      </section>
    </div>
  );
}
