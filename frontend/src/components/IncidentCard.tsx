import { Link } from "react-router-dom";
import type { CrisisEventCard } from "../types";
import { CredibilityWheel } from "./CredibilityWheel";
import {
  getTypeIconPath,
  severityBadgeClass,
  severityDotClass,
  timeAgo,
  normalizeMediaUrl,
  isImageFile
} from "../utils/incident";

export function IncidentCard({ event }: { event: CrisisEventCard }) {
  const mediaThumb = event.mediaFilenames.length > 0 ? event.mediaFilenames[0] : null;
  const thumbUrl = mediaThumb ? normalizeMediaUrl(mediaThumb) : null;

  return (
    <article className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-tide/30">

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
            <path d={getTypeIconPath(event.incidentType)} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink group-hover:text-tide">
              {event.classifiedIncidentTitle || event.title}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severityBadgeClass(event.severityLevel)}`}>
              {event.severityLevel}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {event.descriptionExcerpt}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(event.severityLevel)}`} />
              {event.locationText}
            </span>
            <span>{timeAgo(event.createdAt)}</span>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
              </svg>
              {event.reportCount} report{event.reportCount !== 1 ? "s" : ""} merged
            </span>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
              {event.reporterCount} reporter{event.reporterCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {thumbUrl && isImageFile(mediaThumb!) && (
            <img
              src={thumbUrl}
              alt={`${event.classifiedIncidentTitle || event.title} evidence`}
              className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
              loading="lazy"
            />
          )}
          <CredibilityWheel score={event.credibilityScore} />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          to={`/dashboard/incidents/${event.id}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md bg-tide/10 px-3 py-1.5 text-xs font-semibold text-tide transition hover:bg-tide hover:text-white"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
