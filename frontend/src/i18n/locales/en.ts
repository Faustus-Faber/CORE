/**
 * English translations (§14.6 bilingual support).
 *
 * Keys are grouped by domain: navigation, common actions, report form
 * labels, and status labels. Add new keys here AND in `bn.ts`.
 */

export const en = {
  // ── Navigation ──────────────────────────────────────────────────────────
  "nav.dashboard": "Dashboard",
  "nav.reports": "Reports",
  "nav.map": "Map",
  "nav.evidence": "Evidence",
  "nav.volunteers": "Volunteers",
  "nav.copilot": "Copilot",
  "nav.settings": "Settings",

  // ── Common actions ──────────────────────────────────────────────────────
  "action.submit": "Submit",
  "action.cancel": "Cancel",
  "action.search": "Search",
  "action.filter": "Filter",
  "action.loading": "Loading",
  "action.error": "Error",

  // ── Report form labels ──────────────────────────────────────────────────
  "form.title": "Title",
  "form.description": "Description",
  "form.location": "Location",
  "form.severity": "Severity",
  "form.incidentType": "Incident Type",

  // ── Status labels ───────────────────────────────────────────────────────
  "status.published": "Published",
  "status.underReview": "Under Review",
  "status.rejected": "Rejected",
  "status.clarificationRequested": "Clarification Requested",
} as const;

export type TranslationKey = keyof typeof en;
