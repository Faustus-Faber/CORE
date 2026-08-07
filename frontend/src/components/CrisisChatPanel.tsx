import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

import {
  getCrisisMessagesApi,
  sendCrisisMessageApi,
  deleteCrisisMessageApi,
  togglePinCrisisMessageApi,
  openCrisisChatStream,
} from "../services/api";
import { TrustTierBadge } from "./TrustTierBadge";
import { useAuth } from "../context/AuthContext";
import { normalizeTrustTier } from "../utils/trustTier";
import type { CrisisMessage } from "../types";

type CrisisChatPanelProps = {
  crisisEventId: string;
  crisisTitle: string;
  isOpen: boolean;
  onClose: () => void;
};

export function CrisisChatPanel({
  crisisEventId,
  crisisTitle,
  isOpen,
  onClose,
}: CrisisChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CrisisMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = user?.role === "ADMIN";
  const canSend = Boolean(user);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    try {
      const res = await getCrisisMessagesApi(crisisEventId, 1, 50);
      setMessages(res.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [crisisEventId]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "instant",
        });
      }
    });
  }, []);

  // Set up SSE stream + initial load
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    void loadMessages();

    const es = openCrisisChatStream(crisisEventId);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
    });

    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data) as CrisisMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
        scrollToBottom();
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [isOpen, crisisEventId, loadMessages, scrollToBottom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !loading) {
      inputRef.current?.focus();
    }
  }, [isOpen, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError("");

    try {
      const res = await sendCrisisMessageApi(crisisEventId, trimmed);
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
      setInput("");
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteCrisisMessageApi(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: "[Message deleted by admin]" } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  };

  const handleTogglePin = async (messageId: string) => {
    try {
      const res = await togglePinCrisisMessageApi(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: res.isPinned } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pin message");
    }
  };

  if (!isOpen) return null;

  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);
  const regularMessages = messages.filter((m) => !m.isPinned);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      {/* Centered Gallery-Style Glass Chat Card */}
      <div
        className="relative flex h-[82vh] max-h-[750px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#0e7490]/30 bg-white shadow-2xl ring-1 ring-[#0e7490]/20 z-[100000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="truncate text-base font-bold text-ink font-display">Crisis Coordination Room</h3>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{crisisTitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${connected ? "text-emerald-700" : "text-slate-400"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"} ${connected ? "animate-pulse" : ""}`} />
              {connected ? "Live Stream" : "Connecting..."}
            </span>

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 shadow-xs"
            >
              Close ✕
            </button>
          </div>
        </div>

        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div className="border-b border-amber-200/60 bg-amber-50/80 px-6 py-3 backdrop-blur-xs">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">Pinned Announcement</p>
            <div className="space-y-1.5">
              {pinnedMessages.map((msg) => (
                <div key={msg.id} className="rounded-lg border border-amber-200 bg-white p-2.5 text-xs text-amber-950 shadow-xs">
                  <span className="font-bold text-ink">{msg.senderName}:</span> {msg.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-3 overflow-y-auto p-6 bg-slate-50/30"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-3 border-tide border-t-transparent"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-bold text-ink">No messages in room yet.</p>
              <p className="text-xs text-slate-500">Start the coordination conversation below.</p>
            </div>
          ) : (
            regularMessages.map((msg) => {
              const isMine = msg.senderId === user?.id;
              const senderIsAdmin = msg.senderRole === "ADMIN";

              return (
                <div
                  key={msg.id}
                  className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                    msg.isDeleted
                      ? "bg-slate-100 text-slate-400 italic border border-slate-200"
                      : isMine
                        ? "bg-tide text-white shadow-sm"
                        : senderIsAdmin
                          ? "bg-violet-600 text-white shadow-sm"
                          : "bg-white text-ink border border-slate-200 shadow-xs"
                  }`}>
                    {!isMine && !msg.isDeleted && (
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-bold">{msg.senderName}</span>
                        <TrustTierBadge tier={msg.senderTrustTier} />
                      </div>
                    )}
                    <p className={`leading-relaxed ${msg.isDeleted ? "italic" : ""}`}>
                      {msg.content}
                    </p>
                    <span className={`mt-1 block text-[10px] ${isMine || senderIsAdmin ? "text-white/70" : "text-slate-400"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Admin actions */}
                  {isAdmin && !msg.isDeleted && (
                    <div className="mt-1 flex gap-2 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => void handleTogglePin(msg.id)}
                        className="rounded px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 hover:text-tide"
                        title={msg.isPinned ? "Unpin" : "Pin message"}
                      >
                        {msg.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => void handleDelete(msg.id)}
                        className="rounded px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 hover:text-rose-600"
                        title="Delete message"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error notice */}
        {error && (
          <div className="px-6 py-2">
            <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 border border-red-200">{error}</p>
          </div>
        )}

        {/* Input Footer Bar */}
        {canSend ? (
          <div className="border-t border-slate-200 bg-white p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={2000}
                placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-ink placeholder-slate-400 focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                style={{ maxHeight: "120px" }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-tide text-white shadow-sm transition hover:bg-tide/90 disabled:opacity-40"
                title="Send message"
              >
                {sending ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-xs font-semibold text-slate-500">Sign in to participate in the crisis coordination chat.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
