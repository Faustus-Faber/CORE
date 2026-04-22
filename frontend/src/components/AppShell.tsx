import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getNotifications, toggleDispatchOptInApi } from "../services/api";

type Role = "USER" | "VOLUNTEER" | "ADMIN";

type NavItem = {
  to: string;
  label: string;
};

function buildPrimaryNav(): NavItem[] {
  return [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/map", label: "Map" }
  ];
}

function buildReportMenuItems(role: Role): NavItem[] {
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
    { to: "/resources/my", label: "My Resources" },
    { to: "/browse-resources", label: "Browse Resources" }
  ];
}

function buildCommunityMenuItems(): NavItem[] {
  return [
    { to: "/gallery", label: "Gallery" },
    { to: "/volunteers", label: "Volunteers" },
    { to: "/leaderboard", label: "Leaderboard" }
  ];
}

function buildUserMenuItems(role: Role): NavItem[] {
  const items: NavItem[] = [
    { to: "/profile", label: "Profile" },
    { to: "/notifications", label: "Notifications" },
    { to: "/notifications/preferences", label: "Notification Settings" },
    { to: "/docs", label: "My Documents" }
  ];
  if (role === "VOLUNTEER") {
    items.push({ to: "/tasks", label: "My Timesheet" });
  }
  if (role === "ADMIN") {
    items.push({ to: "/admin", label: "Admin Panel" });
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
  isActive
}: {
  label: string;
  items: NavItem[];
  isActive: boolean;
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
              onClick={() => setOpen(false)}
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

function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <NavLink
      to="/notifications"
      className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-ink"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </NavLink>
  );
}

function DispatchBell({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = async () => {
    setIsLoading(true);
    try {
      const res = await toggleDispatchOptInApi(!optIn);
      setOptIn(res.dispatchOptIn);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={() => void toggle()}
      disabled={isLoading}
      title={optIn ? "Dispatch Alerts: Enabled" : "Dispatch Alerts: Disabled"}
      className={`relative rounded-lg p-2 transition disabled:opacity-50 ${
        optIn ? "text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      }`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill={optIn ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    </button>
  );
}

function MobileSection({
  title,
  items,
  onNavigate,
  navLinkClass
}: {
  title: string;
  items: NavItem[];
  onNavigate: () => void;
  navLinkClass: (args: { isActive: boolean }) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={navLinkClass}
        >
          <span className="block">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function AppShell() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = (user?.role ?? "USER") as Role;
  const primaryNav = user ? buildPrimaryNav() : [];
  const reportMenuItems = user ? buildReportMenuItems(role) : [];
  const resourceMenuItems = user ? buildResourceMenuItems() : [];
  const communityMenuItems = user ? buildCommunityMenuItems() : [];
  const userMenuItems = user ? buildUserMenuItems(role) : [];

  const isReportRoute = location.pathname.startsWith("/report") || location.pathname.startsWith("/reports");
  const isResourceRoute = location.pathname.startsWith("/resources") || location.pathname.startsWith("/browse-resources");
  const isCommunityRoute = communityMenuItems.some(item => location.pathname.startsWith(item.to));

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const poll = () => {
      getNotifications(1, 1).then((data) => setUnreadCount(data.unreadCount));
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user]);

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

  const roleBadge = role === "ADMIN" ? "Admin" : role === "VOLUNTEER" ? "Volunteer" : "User";
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2.5">
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
              <nav className="ml-auto hidden items-center gap-1 lg:flex">
                {primaryNav.map(item => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                ))}
                <Dropdown label="Reports" items={reportMenuItems} isActive={isReportRoute} />
                <Dropdown label="Resources" items={resourceMenuItems} isActive={isResourceRoute} />
                <Dropdown label="Community" items={communityMenuItems} isActive={isCommunityRoute} />
                <span className="mx-1 h-5 w-px bg-slate-200" />
                {role === "VOLUNTEER" && (
                  <DispatchBell initialOptIn={user.dispatchOptIn ?? false} />
                )}
                <NotificationBell unreadCount={unreadCount} />
                <UserMenu
                  userName={user.fullName}
                  userRole={roleBadge}
                  items={userMenuItems}
                  isLoggingOut={isLoggingOut}
                  onLogout={() => void handleLogout()}
                />
              </nav>

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
              {primaryNav.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobile}
                  className={navLinkClass}
                >
                  <span className="block">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <MobileSection title="Reports" items={reportMenuItems} onNavigate={closeMobile} navLinkClass={navLinkClass} />
            <MobileSection title="Resources" items={resourceMenuItems} onNavigate={closeMobile} navLinkClass={navLinkClass} />
            <MobileSection title="Community" items={communityMenuItems} onNavigate={closeMobile} navLinkClass={navLinkClass} />
            <MobileSection title="Account" items={userMenuItems} onNavigate={closeMobile} navLinkClass={navLinkClass} />

            <div className="mt-3 border-t border-slate-100 pt-3">
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
