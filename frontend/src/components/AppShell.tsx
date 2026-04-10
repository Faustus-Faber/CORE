import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

type NavItem = {
  to: string;
  label: string;
};

function buildNavItems(role: "USER" | "VOLUNTEER" | "ADMIN"): NavItem[] {
  const commonItems: NavItem[] = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/map", label: "Map" },
    { to: "/volunteers", label: "Volunteers" },
    { to: "/docs", label: "My Documents" },
    { to: "/profile", label: "Profile" },
    { to: "/leaderboard", label: "Leaderboard" }
  ];

  if (role === "VOLUNTEER") {
    return [...commonItems, { to: "/tasks", label: "My Tasks" }];
  }

  if (role === "ADMIN") {
    return [...commonItems, { to: "/admin", label: "Admin Panel" }];
  }

  return commonItems;
}

function buildReportMenuItems(role: "USER" | "VOLUNTEER" | "ADMIN"): NavItem[] {
  const items: NavItem[] = [
    { to: "/report-incident", label: "Submit Incident" },
    { to: "/reports/explore", label: "Browse Reports" }
  ];

  if (role === "ADMIN") {
    items.push({ to: "/reports/review", label: "Review Unpublished" });
    items.push({ to: "/reports/generate", label: "Generate Reports" });
  }

  return items;
}

function buildResourceMenuItems(): NavItem[] {
  return [
    { to: "/resources/add", label: "Add Resource" },
    { to: "/resources/my", label: "My Resources" }
  ];
}

export function AppShell() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [resourcesMenuOpen, setResourcesMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = user ? buildNavItems(user.role) : [];
  const reportMenuItems = user ? buildReportMenuItems(user.role) : [];
  const resourceMenuItems = buildResourceMenuItems();
  const isReportRoute = location.pathname.startsWith("/report") || location.pathname.startsWith("/reports");
  const isResourceRoute = location.pathname.startsWith("/resources");

  useEffect(() => {
    setReportsMenuOpen(false);
    setResourcesMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-semibold transition ${
      isActive ? "bg-tide text-white" : "text-ink hover:bg-white/60"
    }`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight text-ink">
            CORE
          </Link>

          {!user ? (
            <nav className="hidden items-center gap-2 md:flex">
              <NavLink to="/" className={linkClass}>
                Home
              </NavLink>
              <NavLink to="/login" className={linkClass}>
                Login
              </NavLink>
              <NavLink to="/signup" className={linkClass}>
                Sign Up
              </NavLink>
            </nav>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setReportsMenuOpen(false);
                  setResourcesMenuOpen(false);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium md:hidden"
              >
                Menu
              </button>
              <nav className="hidden items-center gap-1 md:flex">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setReportsMenuOpen((value) => !value)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isReportRoute
                        ? "bg-tide text-white"
                        : "text-ink hover:bg-white/60"
                    }`}
                  >
                    Reports ▾
                  </button>
                  {reportsMenuOpen && (
                    <div className="absolute left-0 z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                      {reportMenuItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setReportsMenuOpen(false)}
                          className={({ isActive }) =>
                            `block px-4 py-2 text-sm font-medium ${
                              isActive
                                ? "bg-tide text-white"
                                : "text-slate-700 hover:bg-slate-50"
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setResourcesMenuOpen((value) => !value)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isResourceRoute
                        ? "bg-tide text-white"
                        : "text-ink hover:bg-white/60"
                    }`}
                  >
                    Resources ▾
                  </button>
                  {resourcesMenuOpen && (
                    <div className="absolute left-0 z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                      {resourceMenuItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setResourcesMenuOpen(false)}
                          className={({ isActive }) =>
                            `block px-4 py-2 text-sm font-medium ${
                              isActive
                                ? "bg-tide text-white"
                                : "text-slate-700 hover:bg-slate-50"
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-white/60"
                >
                  Notifications (3)
                </button>
                {user.role === "VOLUNTEER" && (
                  <button
                    type="button"
                    className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white"
                  >
                    Dispatch Alert
                  </button>
                )}
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                  className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </nav>
            </>
          )}
        </div>
        {menuOpen && user && (
          <nav className="space-y-1 border-t border-slate-200 px-4 py-3 md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-1 border-t border-slate-200 pt-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reports
              </p>
              {reportMenuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={linkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-1 border-t border-slate-200 pt-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resources
              </p>
              {resourceMenuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={linkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-2 w-full rounded-md bg-ink px-3 py-2 text-left text-sm font-semibold text-white"
            >
              Logout
            </button>
          </nav>
        )}
      </header>

      <main className="relative h-[calc(100vh-64px)] w-full">
        <Outlet />
      </main>
    </div>
  );
}
