import type { CrisisEventCard } from "../types";
import { IncidentCard } from "./IncidentCard";

type IncidentFeedProps = {
  events: CrisisEventCard[];
  loading: boolean;
  error: string;
};

export function IncidentFeed({ events, loading, error }: IncidentFeedProps) {
  if (loading && events.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center ring-1 ring-red-200">
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-panel ring-1 ring-slate-200">
        <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12 fill-slate-300">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        <p className="mt-3 text-sm font-semibold text-slate-600">No incidents match your filters</p>
        <p className="mt-1 text-xs text-slate-500">Try adjusting the filter criteria above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div
          key={event.id}
          style={{ animationDelay: `${index * 60}ms` }}
          className="animate-[slideUp_0.3s_ease-out_both]"
        >
          <IncidentCard event={event} />
        </div>
      ))}
    </div>
  );
}