import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getNotifications,
  markNotificationRead,
  NotificationItem,
  approveReservationApi,
  declineReservationApi,
  clearHandledNotifications
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { stripThinkingTags } from "../utils/sanitize";
import { severityBadgeClass, severityDotClass, timeAgo } from "../utils/incident";
import type { IncidentSeverity } from "../types";

const PAGE_SIZE = 20;

function extractSeverity(title: string): IncidentSeverity {
  const m = title.match(/^(CRITICAL|HIGH|MEDIUM|LOW)/i);
  return (m ? m[1].toUpperCase() : "MEDIUM") as IncidentSeverity;
}

function extractType(title: string): string {
  return title
    .replace(/^(CRITICAL|HIGH|MEDIUM|LOW)\s+/i, "")
    .replace(/\s*Alert$/i, "")
    .replace(/_/g, " ");
}

export function NotificationInbox() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    getNotifications(page)
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const refreshNotifications = async (targetPage = page) => {
    const data = await getNotifications(targetPage);
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setTotal(data.total);
  };

  const handleSelect = async (n: NotificationItem) => {
    if (!n.isRead) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setExpandedId(expandedId === n.id ? null : n.id);
  };

  const handleApprove = async (reservationId: string) => {
    await approveReservationApi(reservationId);
    await refreshNotifications(page);
    setExpandedId(null);
  };

  const handleDecline = async (reservationId: string) => {
    await declineReservationApi(reservationId);
    await refreshNotifications(page);
    setExpandedId(null);
  };

  const handleClearHandled = async () => {
    await clearHandledNotifications();
    await refreshNotifications(page);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold text-ink">Notifications</h1>
          <p className="mt-2 text-slate-700">
            Crisis alerts and safety advisories based on your preferences.
          </p>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200 text-center">
          <p className="text-sm text-slate-700">No notifications yet.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-ink">Notifications</h1>
            <p className="mt-2 text-slate-700">
              Crisis alerts and safety advisories based on your preferences.
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">
              {unreadCount} unread
            </span>
          )}
          <button
            onClick={handleClearHandled}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear handled
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Recent Alerts</h2>
          <p className="text-sm text-slate-600">{notifications.length} alert(s)</p>
        </div>

        <div className="space-y-3">
          {notifications.map((n) => {
            const severity = extractSeverity(n.title);
            const type = extractType(n.title);
            const isExpanded = expandedId === n.id;
            const instruction = n.survivalInstruction
              ? stripThinkingTags(n.survivalInstruction)
              : null;
            const hasInstruction = instruction && instruction.length > 0;

            return (
              <article
                key={n.id}
                className={`group rounded-xl border bg-white p-4 shadow-sm ring-1 transition-all ${
                  isExpanded
                    ? "border-tide/40 ring-tide/20 shadow-md"
                    : n.isRead
                      ? "border-slate-200 ring-slate-100 hover:shadow-md hover:ring-tide/30"
                      : "border-blue-200 ring-blue-100 hover:shadow-md hover:ring-tide/30"
                }`}
              >
                <button
                  onClick={() => handleSelect(n)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`truncate text-base font-semibold ${
                            isExpanded ? "text-tide" : "text-ink group-hover:text-tide"
                          }`}
                        >
                          {type} Alert
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severityBadgeClass(severity)}`}
                        >
                          {severity}
                        </span>
                        {!n.isRead && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                            New
                          </span>
                        )}
                        {hasInstruction && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Safety Info
                          </span>
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {n.body}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(severity)}`} />
                          {severity} severity
                        </span>
                        <span>{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>

                    <svg
                      className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && hasInstruction && (
                  <div className="mt-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                      Safety Instructions
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      AI-generated safety guidance for this emergency
                    </p>
                    <div className="si-content mt-3 text-sm leading-relaxed text-slate-700">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {instruction ?? ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {isExpanded && n.type === "RESERVATION_REQUEST" && n.reservationId && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleApprove(n.reservationId!)}
                      className="rounded-md bg-green-600 px-4 py-2 text-white"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(n.reservationId!)}
                      className="rounded-md bg-red-600 px-4 py-2 text-white"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {isExpanded && n.type === "RESERVATION_APPROVED" && (
                  <p className="mt-3 text-sm font-semibold text-green-700">
                    Request approved
                  </p>
                )}

                {isExpanded && n.type === "RESERVATION_DECLINED" && (
                  <p className="mt-3 text-sm font-semibold text-red-700">
                    Request denied
                  </p>
                )}

                {isExpanded && n.type === "NGO_REPORT_PROMPT" && isAdmin && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-tide/30 bg-tide/5 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">Generate NGO Summary Report</p>
                      <p className="text-xs text-slate-600">Compile a formal summary now that the crisis is resolved.</p>
                    </div>
                    <Link
                      to={
                        n.crisisEventId
                          ? `/reports/generate?crisisEventId=${n.crisisEventId}`
                          : "/reports/generate"
                      }
                      className="rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-tide/90"
                    >
                      Generate Report
                    </Link>
                  </div>
                )}

                {isExpanded && n.type === "CRISIS_UPDATE" && n.crisisEventId && (
                  <div className="mt-4">
                    <Link
                      to={`/dashboard/incidents/${n.crisisEventId}`}
                      className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View Incident Timeline
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
          <p className="text-slate-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <style>{`
        .si-content p {
          margin-bottom: 0.625rem;
        }
        .si-content p:last-child {
          margin-bottom: 0;
        }
        .si-content strong {
          color: #1f2a37;
          font-weight: 600;
        }
        .si-content ul,
        .si-content ol {
          list-style: none;
          padding: 0;
          margin: 0.25rem 0 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .si-content li {
          position: relative;
          padding-left: 1.5rem;
          line-height: 1.6;
        }
        .si-content li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.45em;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background: #0e7490;
          opacity: 0.6;
        }
        .si-content h1,
        .si-content h2,
        .si-content h3,
        .si-content h4 {
          font-weight: 700;
          color: #1f2a37;
          margin: 0.5rem 0 0.25rem;
        }
      `}</style>
    </div>
  );
}
