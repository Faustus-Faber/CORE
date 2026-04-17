import { useEffect, useState } from "react";
import { getNotifications, markNotificationRead, NotificationItem } from "../services/api";
import { stripThinkingTags } from "../utils/sanitize";
import { severityBadgeClass, severityDotClass, timeAgo } from "../utils/incident";
import type { IncidentSeverity } from "../types";
import { approveReservationApi, declineReservationApi } from "../services/api";
import { clearHandledNotifications } from "../services/api";


/* ── Markdown-lite renderer for AI safety instructions ─────────────── */

function renderSafetyHtml(raw: string): string {
  let text = stripThinkingTags(raw);

  // bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const lines = text.split("\n").filter((l) => l.trim());
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-•]\s+(.+)/);

    if (bullet) {
      if (!inList) { out.push('<ul class="si-list">'); inList = true; }
      out.push(`<li>${bullet[1]}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${trimmed}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

/* ── Extract severity / type from title like "CRITICAL FLOOD Alert" ── */

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

/* ── Main component ──────────────────────────────────────────────────── */

export function NotificationInbox() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getNotifications(page)
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .finally(() => setLoading(false));
  }, [page]);
const refreshNotifications = async (targetPage = page) => {
  const data = await getNotifications(targetPage);
  setNotifications(data.notifications);
  setUnreadCount(data.unreadCount);
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

  await refreshNotifications(page); // 👈 PUT IT HERE

  setExpandedId(null);
};

const handleDecline = async (reservationId: string) => {
  await declineReservationApi(reservationId);

  await refreshNotifications(page); // 👈 SAME PLACE

  setExpandedId(null);
};

const handleClearHandled = async () => {
  await clearHandledNotifications();
  await refreshNotifications(page);
};

  /* ──── Loading skeleton (matches ReportDetailPage) ─────────────── */
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

  /* ──── Empty state ─────────────────────────────────────────────── */
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

  /* ──── Main layout ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header panel — matches ReportsExplorerPage */}
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

      {/* Notification list panel */}
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Recent Alerts</h2>
          <p className="text-sm text-slate-600">{notifications.length} alert(s)</p>
        </div>

        <div className="space-y-3">
          {notifications.map((n) => {
            console.log("NOTIFICATION:", n.id, n.type, n.reservationId);
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
                    {/* Icon box — same as ReportCard */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title row with badges — same pattern as ReportCard */}
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

                      {/* Body text */}
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {n.body}
                      </p>

                      {/* Meta row — same style as ReportCard */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(severity)}`} />
                          {severity} severity
                        </span>
                        <span>{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>

                    {/* Chevron */}
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

                {/* ── Expanded: Safety Instructions panel ──────────────── */}
                {isExpanded && hasInstruction && (
                  
                  <div className="mt-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                      Safety Instructions
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      AI-generated safety guidance for this emergency
                    </p>
                    <div
                      className="si-content mt-3 text-sm leading-relaxed text-slate-700"
                      dangerouslySetInnerHTML={{
                        __html: renderSafetyHtml(n.survivalInstruction!)
                      }}
                    />
                  </div>
                )}

                {isExpanded && (
  n.type === "RESERVATION_REQUEST" && n.reservationId ? (
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
  ) : n.type === "RESERVATION_APPROVED" ? (
    <p className="mt-3 text-sm font-semibold text-green-700">
      Request approved
    </p>
  ) : n.type === "RESERVATION_DECLINED" ? (
    <p className="mt-3 text-sm font-semibold text-red-700">
      Request denied
    </p>
  ) : null
)}
              </article>
            );
          })}
        </div>

        {/* Pagination — same as ReportsExplorerPage */}
        <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
          <p className="text-slate-600">Page {page}</p>
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
              disabled={notifications.length < 20}
              className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Scoped styles for safety instruction content */}
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
        .si-list {
          list-style: none;
          padding: 0;
          margin: 0.25rem 0 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .si-list li {
          position: relative;
          padding-left: 1.5rem;
          line-height: 1.6;
        }
        .si-list li::before {
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
      `}</style>
    </div>
  );
}
