import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

type NavItem = {
  to: string;
  label: string;
};

function buildNavItems(role: "USER" | "VOLUNTEER" | "ADMIN"): NavItem[] {
  const commonItems: NavItem[] = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/map", label: "Map" },
    { to: "/resources", label: "Resources" },
    { to: "/volunteers", label: "Volunteers" },
    { to: "/profile", label: "Profile" },
    { to: "/leaderboard", label: "Leaderboard" }
  ];

  if (role === "VOLUNTEER") {
    return [...commonItems, { to: "/tasks", label: "My Tasks" }];
  }

  if (role === "ADMIN") {
    return [...commonItems, { to: "/admin", label: "Admin Panel" }, { to: "/reports", label: "Generate Reports" }];
  }

  return commonItems;
}

export function AppShell() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = user ? buildNavItems(user.role) : [];

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
                onClick={() => setMenuOpen((value) => !value)}
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

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
