/**
 * FR-02: Offline draft persistence for incident reports.
 *
 * Saves report wizard state to localStorage so that if the user loses
 * connectivity or accidentally closes the tab, their in-progress report
 * is preserved and can be restored on the next visit.
 */

const DRAFT_KEY = "core:report-draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ReportDraft = {
  description: string;
  incidentType: string;
  transcript: string;
  translation: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  observedAt: string;
  affectedPeople: number | null;
  immediateNeeds: string;
  mediaConsent: boolean;
  aiConsent: boolean;
  contactBack: boolean;
  savedAt: number;
};

export function saveReportDraft(draft: Omit<ReportDraft, "savedAt">): void {
  try {
    const payload: ReportDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded) — fail silently
  }
}

export function loadReportDraft(): ReportDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as ReportDraft;
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearReportDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // fail silently
  }
}
