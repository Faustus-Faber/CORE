import { useState } from "react";
import { Link } from "react-router-dom";
import type { CrisisEventCard, IncidentType, IncidentSeverity } from "../types";

const typeIcons: Record<IncidentType, string> = {
  FLOOD: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  FIRE: "M12 23c-3.6 0-8-2.4-8-7.7 0-3.5 2.3-6.3 4.1-8.2.8-.9 1.5-1.6 1.9-2.3.4.7 1.1 1.4 1.9 2.3C13.7 9 16 11.8 16 15.3 16 20.6 15.6 23 12 23zm0-17.4c-.3.4-.7.8-1.1 1.3C9.3 8.6 7.3 11 7.3 15.3 7.3 19 10.2 20.7 12 20.7s4.7-1.7 4.7-5.4c0-4.3-2-6.7-3.6-8.4-.4-.5-.8-.9-1.1-1.3z",
  EARTHQUAKE: "M2 18h2v2H2v-2zm4 0h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM4 12l2 3h12l2-3H4zm16-6H4l-2 4h20l-2-4z",
  BUILDING_COLLAPSE: "M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z",
  ROAD_ACCIDENT: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
  VIOLENCE: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  MEDICAL_EMERGENCY: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z",
  OTHER: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
};

function severityColor(severity: IncidentSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-800 ring-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "LOW":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
}

function severityDotColor(severity: IncidentSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500";
    case "HIGH":
      return "bg-orange-500";
    case "MEDIUM":
      return "bg-amber-500";
    case "LOW":
      return "bg-emerald-500";
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function credibilityStyle(score: number) {
  if (score >= 70) {
    return { stroke: "stroke-emerald-500", track: "stroke-emerald-100", text: "text-emerald-700" };
  }
  if (score >= 40) {
    return { stroke: "stroke-amber-500", track: "stroke-amber-100", text: "text-amber-700" };
  }
  return { stroke: "stroke-red-500", track: "stroke-red-100", text: "text-red-700" };
}

function MiniCredibilityWheel({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeScore / 100) * circumference;
  const style = credibilityStyle(safeScore);

  return (
    <div className="relative h-10 w-10 flex-shrink-0">
      <svg viewBox="0 0 48 48" className="h-10 w-10">
        <circle cx="24" cy="24" r={radius} strokeWidth="5" className={`fill-none ${style.track}`} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          strokeWidth="5"
          strokeLinecap="round"
          className={`fill-none ${style.stroke}`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${style.text}`}>{safeScore}</span>
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

function normalizeMediaUrl(filePath: string) {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
  if (filePath.startsWith("/")) return `${API_ORIGIN}${filePath}`;
  return `${API_ORIGIN}/uploads/reports/${filePath}`;
}

function isImageFile(filePath: string) {
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(filePath);
}

export function IncidentCard({ event }: { event: CrisisEventCard }) {
  const [expanded, setExpanded] = useState(false);

  const mediaThumb = event.mediaFilenames.length > 0 ? event.mediaFilenames[0] : null;
  const thumbUrl = mediaThumb ? normalizeMediaUrl(mediaThumb) : null;

  return (
    <article
      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-tide/30"
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
            <path d={typeIcons[event.incidentType] ?? typeIcons.OTHER} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink group-hover:text-tide">
              {event.classifiedIncidentTitle || event.title}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severityColor(event.severityLevel)}`}>
              {event.severityLevel}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {event.descriptionExcerpt}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${severityDotColor(event.severityLevel)}`} />
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
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
              loading="lazy"
            />
          )}
          <MiniCredibilityWheel score={event.credibilityScore} />
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