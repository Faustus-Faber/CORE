import { useEffect, useState } from "react";

import { submitCrisisUpdate } from "../services/api";
import { SEVERITY_OPTIONS } from "../utils/incident";
import type {
  ClosureChecklist,
  CrisisAccessStatus,
  CrisisEventStatusExpanded,
  CrisisUpdateType,
  IncidentSeverity
} from "../types";

const STATUS_ORDER: CrisisEventStatusExpanded[] = [
  "REPORTED",
  "VERIFIED",
  "UNDER_INVESTIGATION",
  "RESPONSE_IN_PROGRESS",
  "CONTAINED",
  "RESOLVED",
  "CLOSED"
];

const UPDATE_TYPE_OPTIONS: Array<{
  value: Exclude<CrisisUpdateType, "RESPONDER_STATUS">;
  label: string;
  description: string;
  adminOnly?: boolean;
}> = [
  {
    value: "FIELD_OBSERVATION",
    label: "Field Observation",
    description: "Share verified ground conditions without changing the status."
  },
  {
    value: "STATUS_CHANGE",
    label: "Status Change",
    description: "Advance the operational status when the field situation changes."
  },
  {
    value: "ACCESS_UPDATE",
    label: "Access Update",
    description: "Record route access, blocked paths, or safe corridors."
  },
  {
    value: "IMPACT_UPDATE",
    label: "Impact Update",
    description: "Refresh casualty, displacement, or damage estimates."
  },
  {
    value: "RESOURCE_NEED",
    label: "Resource Need",
    description: "Call out urgent supplies, teams, or support requirements."
  },
  {
    value: "CLOSURE_NOTE",
    label: "Closure Note",
    description: "Document closure readiness and final field verification."
  },
  {
    value: "ADMIN_CORRECTION",
    label: "Admin Correction",
    description: "Add an official correction without changing the current status.",
    adminOnly: true
  }
];

const ACCESS_STATUS_OPTIONS: Array<{ value: CrisisAccessStatus; label: string }> = [
  { value: "OPEN", label: "Open" },
  { value: "LIMITED", label: "Limited" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "UNKNOWN", label: "Unknown" }
];

const NOTE_PLACEHOLDERS: Record<
  Exclude<CrisisUpdateType, "RESPONDER_STATUS">,
  string
> = {
  FIELD_OBSERVATION: "Summarise what you verified on the ground.",
  STATUS_CHANGE: "Explain why the operational status should change now.",
  ACCESS_UPDATE: "Describe road access, blocked paths, or usable entry routes.",
  IMPACT_UPDATE: "Document casualty, displacement, or damage changes.",
  RESOURCE_NEED: "State what teams, supplies, or support are urgently needed.",
  CLOSURE_NOTE: "Capture why this crisis is ready to resolve or close.",
  ADMIN_CORRECTION: "Add the official correction for the command timeline."
};

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusOptions(
  currentStatus: CrisisEventStatusExpanded,
  updateType: Exclude<CrisisUpdateType, "RESPONDER_STATUS">,
  isAdmin: boolean
): CrisisEventStatusExpanded[] {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const forwardStatuses = STATUS_ORDER.slice(currentIndex);

  if (updateType === "STATUS_CHANGE") {
    const options = forwardStatuses.filter((status) => status !== currentStatus);
    return options.length > 0 ? options : [currentStatus];
  }

  if (updateType === "CLOSURE_NOTE") {
    const options = forwardStatuses.filter((status) => {
      if (status === "CLOSED") return isAdmin;
      return status === currentStatus || status === "RESOLVED";
    });
    return options.length > 0 ? options : [currentStatus];
  }

  return [currentStatus];
}

type CrisisUpdateFormProps = {
  crisisEventId: string;
  currentStatus: CrisisEventStatusExpanded;
  isAdmin: boolean;
  onSubmit: () => void;
};

export function CrisisUpdateForm({
  crisisEventId,
  currentStatus,
  isAdmin,
  onSubmit
}: CrisisUpdateFormProps) {
  const availableTypes = UPDATE_TYPE_OPTIONS.filter(
    (option) => !option.adminOnly || isAdmin
  );
  const [updateType, setUpdateType] = useState<
    Exclude<CrisisUpdateType, "RESPONDER_STATUS">
  >("FIELD_OBSERVATION");
  const [status, setStatus] = useState<CrisisEventStatusExpanded>(currentStatus);
  const [updateNote, setUpdateNote] = useState("");
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity | "">("");
  const [affectedArea, setAffectedArea] = useState("");
  const [accessStatus, setAccessStatus] = useState<CrisisAccessStatus | "">("");
  const [casualtyCount, setCasualtyCount] = useState("");
  const [displacedCount, setDisplacedCount] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [resourceNeeds, setResourceNeeds] = useState("");
  const [closureChecklist, setClosureChecklist] = useState<ClosureChecklist>({
    areaSafe: false,
    peopleAccounted: false,
    urgentNeedsStabilized: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const statusOptions = getStatusOptions(currentStatus, updateType, isAdmin);
  const shouldShowClosureChecklist =
    updateType === "CLOSURE_NOTE" || status === "RESOLVED" || status === "CLOSED";
  const needsAccessFields = updateType === "ACCESS_UPDATE";
  const needsImpactFields = updateType === "IMPACT_UPDATE";
  const needsResourceFields = updateType === "RESOURCE_NEED";
  const statusLocked =
    updateType !== "STATUS_CHANGE" && updateType !== "CLOSURE_NOTE";

  useEffect(() => {
    const nextStatus = statusOptions[0] ?? currentStatus;
    if (!statusOptions.includes(status)) {
      setStatus(nextStatus);
    }
  }, [currentStatus, status, statusOptions]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const normalizedNeeds = resourceNeeds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8);

      await submitCrisisUpdate(crisisEventId, {
        updateType,
        status,
        updateNote,
        newSeverity: newSeverity || undefined,
        affectedArea: affectedArea || undefined,
        accessStatus: accessStatus || undefined,
        casualtyCount: casualtyCount ? parseInt(casualtyCount, 10) : undefined,
        displacedCount: displacedCount ? parseInt(displacedCount, 10) : undefined,
        damageNotes: damageNotes || undefined,
        resourceNeeds: normalizedNeeds.length > 0 ? normalizedNeeds : undefined,
        closureChecklist: shouldShowClosureChecklist ? closureChecklist : undefined
      });

      onSubmit();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit incident command update"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
          Update Type
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {availableTypes.map((option) => {
            const active = updateType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setUpdateType(option.value)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-tide bg-tide/10 text-tide shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-tide/40 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Situation Note
          </label>
          <textarea
            value={updateNote}
            onChange={(event) => setUpdateNote(event.target.value)}
            maxLength={1000}
            rows={4}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
            placeholder={NOTE_PLACEHOLDERS[updateType]}
            required
          />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Command Status
            </p>
            {statusLocked ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                {formatLabel(currentStatus)}
              </div>
            ) : (
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CrisisEventStatusExpanded)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
              >
                {statusOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Severity
            </label>
            <select
              value={newSeverity}
              onChange={(event) =>
                setNewSeverity(event.target.value as IncidentSeverity | "")
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
            >
              <option value="">No change</option>
              {SEVERITY_OPTIONS.filter((option) => option.value !== "ALL").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Affected Area
          </label>
          <input
            type="text"
            value={affectedArea}
            onChange={(event) => setAffectedArea(event.target.value)}
            maxLength={500}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
            placeholder="Example: Eastern embankment to ward 7 school grounds"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Access State
          </label>
          <select
            value={accessStatus}
            onChange={(event) =>
              setAccessStatus(event.target.value as CrisisAccessStatus | "")
            }
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              needsAccessFields
                ? "border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-500"
                : "border-slate-300 focus:border-tide focus:ring-tide"
            }`}
          >
            <option value="">No update</option>
            {ACCESS_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Casualties
            </label>
            <input
              type="number"
              min={0}
              value={casualtyCount}
              onChange={(event) => setCasualtyCount(event.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                needsImpactFields
                  ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:border-tide focus:ring-tide"
              }`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Displaced
            </label>
            <input
              type="number"
              min={0}
              value={displacedCount}
              onChange={(event) => setDisplacedCount(event.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                needsImpactFields
                  ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:border-tide focus:ring-tide"
              }`}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Damage Notes
          </label>
          <input
            type="text"
            value={damageNotes}
            onChange={(event) => setDamageNotes(event.target.value)}
            maxLength={1000}
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              needsImpactFields
                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500"
                : "border-slate-300 focus:border-tide focus:ring-tide"
            }`}
            placeholder="Example: North stairwell collapsed, smoke still visible"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Urgent Resource Needs
        </label>
        <input
          type="text"
          value={resourceNeeds}
          onChange={(event) => setResourceNeeds(event.target.value)}
          className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            needsResourceFields
              ? "border-emerald-300 bg-emerald-50 focus:border-emerald-500 focus:ring-emerald-500"
              : "border-slate-300 focus:border-tide focus:ring-tide"
          }`}
          placeholder="Comma-separated tags, for example rescue boat, trauma kit, shelter tents"
        />
      </div>

      {shouldShowClosureChecklist && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
            Closure Checklist
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              {
                key: "areaSafe" as const,
                label: "Area Safe"
              },
              {
                key: "peopleAccounted" as const,
                label: "People Accounted"
              },
              {
                key: "urgentNeedsStabilized" as const,
                label: "Urgent Needs Stabilised"
              }
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={closureChecklist[item.key]}
                  onChange={(event) =>
                    setClosureChecklist((current) => ({
                      ...current,
                      [item.key]: event.target.checked
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-tide px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Publishing..." : "Publish Command Update"}
      </button>
    </form>
  );
}
