/**
 * CrisisEventList — accessible list alternative to the crisis map (§14.6).
 *
 * Per refinement plan §14.6:
 *   - "Every map-based view must have an accessible list alternative."
 *   - "Screen-reader users and keyboard users must be able to access all
 *      information without relying on a visual map."
 *
 * This component fetches crisis events from `/api/reports/crisis-events`
 * and renders them as a semantic, keyboard-navigable HTML list with
 * proper ARIA roles. A toggle button lets users switch between the
 * "Map View" and "List View".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listCrisisEvents, type CrisisEventListItem } from "../services/api";
import { ErrorState } from "./ui/ErrorState";

type ViewMode = "list" | "map";

interface CrisisEventListProps {
  /** Optional callback to render the map view when the user toggles to it. */
  renderMapView?: () => React.ReactNode;
  /** Optional initial view mode (defaults to "list"). */
  initialView?: ViewMode;
}

export function CrisisEventList({
  renderMapView,
  initialView = "list",
}: CrisisEventListProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CrisisEventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(initialView);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCrisisEvents();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load crisis events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // Focus the first item when the list loads or data refreshes
  useEffect(() => {
    if (view === "list" && !isLoading && events.length > 0 && listRef.current) {
      const firstItem = listRef.current.querySelector<HTMLButtonElement>("[data-event-item]");
      firstItem?.focus();
    }
  }, [view, isLoading, events]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(`/dashboard/incidents/${events[index].id}`);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(index + 1, events.length - 1);
      setFocusedIndex(next);
      const items = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-event-item]");
      items?.[next]?.focus();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(index - 1, 0);
      setFocusedIndex(prev);
      const items = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-event-item]");
      items?.[prev]?.focus();
      return;
    }
  };

  const toggleView = () => {
    setView((v) => (v === "list" ? "map" : "list"));
  };

  return (
    <section aria-labelledby="crisis-list-heading">
      {/* View toggle */}
      <div className="mb-4 flex items-center justify-between">
        <h2 id="crisis-list-heading" className="text-lg font-bold text-ink">
          Crisis Events
        </h2>
        <button
          type="button"
          onClick={toggleView}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          aria-label={view === "list" ? "Switch to map view" : "Switch to list view"}
        >
          {view === "list" ? (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              Map View
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              List View
            </>
          )}
        </button>
      </div>

      {view === "map" && renderMapView ? (
        <div role="region" aria-label="Crisis events map view">
          {renderMapView()}
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-tide" />
              <span className="ml-3 text-sm text-slate-500">Loading crisis events…</span>
            </div>
          )}

          {error && !isLoading && (
            <ErrorState
              message="Failed to load crisis events"
              detail={error}
              onRetry={() => void fetchEvents()}
            />
          )}

          {!isLoading && !error && events.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">No crisis events found.</p>
            </div>
          )}

          {!isLoading && !error && events.length > 0 && (
            <ul
              ref={listRef}
              role="list"
              aria-label="Crisis events list"
              className="space-y-3"
            >
              {events.map((event, index) => (
                <li key={event.id} role="listitem">
                  <button
                    type="button"
                    data-event-item
                    onClick={() => navigate(`/dashboard/incidents/${event.id}`)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    aria-label={`${event.title}, type ${event.type}, severity ${event.severity}, status ${event.status}, location ${event.location}, ${event.reportCount} report${event.reportCount !== 1 ? "s" : ""}. Press Enter to view details.`}
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:border-slate-300 hover:shadow-md hover:ring-tide/30 focus:outline-none focus:ring-2 focus:ring-tide"
                  >
                    {/* Title */}
                    <h3 className="text-base font-semibold text-ink">
                      {event.title}
                    </h3>

                    {/* Metadata row */}
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-slate-500">Type:</dt>
                        <dd>{event.type.replace(/_/g, " ").toLowerCase()}</dd>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-slate-500">Severity:</dt>
                        <dd>
                          <span className="font-semibold">
                            {event.severity}
                          </span>
                        </dd>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-slate-500">Location:</dt>
                        <dd>{event.location}</dd>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-slate-500">Status:</dt>
                        <dd>{event.status.replace(/_/g, " ").toLowerCase()}</dd>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-slate-500">Reports:</dt>
                        <dd>{event.reportCount}</dd>
                      </div>
                    </dl>

                    <p className="mt-2 text-xs text-slate-400">
                      Press Enter to view details
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
