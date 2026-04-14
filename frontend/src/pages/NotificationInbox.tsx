import { useEffect, useState } from "react";
import { getNotifications, markNotificationRead, NotificationItem } from "../services/api";

export function NotificationInbox() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NotificationItem | null>(null);

  useEffect(() => {
    setLoading(true);
    getNotifications(page)
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const handleSelect = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setSelected(notification);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return <p className="text-center text-sm text-slate-500 py-12">No notifications</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => handleSelect(n)}
            className={`w-full text-left rounded-lg border p-4 transition-colors ${
              n.isRead
                ? "border-slate-200 bg-white"
                : "border-blue-200 bg-blue-50"
            } hover:bg-slate-50`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{n.body}</p>
                <span className="text-xs text-slate-400 mt-1 block">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2" />}
            </div>
          </button>
        ))}
      </div>

      {selected && selected.survivalInstruction && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Safety Instructions</h3>
          <p className="text-sm text-amber-900 leading-relaxed">
            {selected.survivalInstruction}
          </p>
        </div>
      )}
    </div>
  );
}
