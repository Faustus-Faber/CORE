import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

type NavItem = {
  to: string;
  label: string;
};

function buildPrimaryNav(role: "USER" | "VOLUNTEER" | "ADMIN"): NavItem[] {
  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/map", label: "Map" },
    { to: "/volunteers", label: "Volunteers" },
    { to: "/leaderboard", label: "Leaderboard" }
  ];
  if (role === "ADMIN") {
    items.push({ to: "/admin", label: "Admin Panel" });
  }
  return items;
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

function buildUserMenuItems(role: "USER" | "VOLUNTEER" | "ADMIN"): NavItem[] {
  const items: NavItem[] = [
    { to: "/profile", label: "Profile" },
    { to: "/docs", label: "My Documents" }
  ];
  if (role === "VOLUNTEER") {
    items.push({ to: "/tasks", label: "My Tasks" });
  }
  return items;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

function Dropdown({
  label,
  items,
  isActive,
  onNavigate
}: {
  label: string;
  items: NavItem[];
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useClickOutside(ref, () => setOpen(false));
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive
            ? "bg-tide/10 text-tide"
            : "text-slate-600 hover:bg-slate-100 hover:text-ink"
        }`}
      >
        {label}
        <svg className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-52 origin-top-left animate-[fadeIn_100ms_ease-out] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className={({ isActive: active }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-tide/10 text-tide"
                    : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({
  userName,
  userRole,
  items,
  isLoggingOut,
  onLogout
}: {
  userName: string;
  userRole: string;
  items: NavItem[];
  isLoggingOut: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useClickOutside(ref, () => setOpen(false));
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const initials = (userName ?? "")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tide text-xs font-bold text-white">
          {initials}
        </span>
        <span className="hidden max-w-[100px] truncate sm:block">{userName.split(" ")[0]}</span>
        <svg className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right animate-[fadeIn_100ms_ease-out] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">{userName}</p>
            <p className="text-xs text-slate-500">{userRole}</p>
          </div>
          <div className="py-1">
            {items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-tide/10 text-tide"
                      : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = user ? buildPrimaryNav(user.role) : [];
  const reportMenuItems = user ? buildReportMenuItems(user.role) : [];
  const resourceMenuItems = buildResourceMenuItems();
  const userMenuItems = user ? buildUserMenuItems(user.role) : [];
  const isReportRoute = location.pathname.startsWith("/report") || location.pathname.startsWith("/reports");
  const isResourceRoute = location.pathname.startsWith("/resources");

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-tide/10 text-tide"
        : "text-slate-600 hover:bg-slate-100 hover:text-ink"
    }`;

  const roleBadge = user?.role === "ADMIN" ? "Admin" : user?.role === "VOLUNTEER" ? "Volunteer" : "User";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2.5">
          {/* Brand */}
          <Link to="/" className="text-xl font-black tracking-tight text-ink">
            CORE
          </Link>

          {!user ? (
            <nav className="ml-auto flex items-center gap-1">
              <NavLink to="/" end className={navLinkClass}>Home</NavLink>
              <NavLink to="/login" className={navLinkClass}>Login</NavLink>
              <NavLink
                to="/signup"
                className="rounded-lg bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-tide/90"
              >
                Sign Up
              </NavLink>
            </nav>
          ) : (
            <>
              {/* Desktop nav — pushed to the right */}
              <nav className="ml-auto hidden items-center gap-1 lg:flex">
                {navItems.map(item => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                ))}
                <Dropdown label="Reports" items={reportMenuItems} isActive={isReportRoute} />
                <Dropdown label="Resources" items={resourceMenuItems} isActive={isResourceRoute} />
                <span className="mx-1 h-5 w-px bg-slate-200" />
                {user.role === "VOLUNTEER" && (
                  <button
                    type="button"
                    className="rounded-lg bg-ember/10 px-3 py-2 text-sm font-semibold text-ember transition hover:bg-ember/20"
                  >
                    Dispatch Alert
                  </button>
                )}
                <UserMenu
                  userName={user.fullName}
                  userRole={roleBadge}
                  items={userMenuItems}
                  isLoggingOut={isLoggingOut}
                  onLogout={() => void handleLogout()}
                />
              </nav>

              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileOpen(v => !v)}
                className="ml-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>

        {/* Mobile menu */}
        {mobileOpen && user && (
          <nav className="animate-[fadeIn_150ms_ease-out] border-t border-slate-200/80 bg-white px-4 pb-4 pt-3 lg:hidden">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tide text-sm font-bold text-white">
                {user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{user.fullName}</p>
                <p className="text-xs text-slate-500">{roleBadge}</p>
              </div>
            </div>

            <div className="mt-3 space-y-0.5">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass}
                >
                  <span className="block">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Reports
              </p>
              {reportMenuItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass}
                >
                  <span className="block">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Resources
              </p>
              {resourceMenuItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass}
                >
                  <span className="block">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Account
              </p>
              {userMenuItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass}
                >
                  <span className="block">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              {user.role === "VOLUNTEER" && (
                <button
                  type="button"
                  className="mb-2 w-full rounded-lg bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember"
                >
                  Dispatch Alert
                </button>
              )}
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                className="w-full rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
