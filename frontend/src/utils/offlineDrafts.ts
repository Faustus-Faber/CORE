/**
 * Offline report drafts — local storage queue for reports that couldn't
 * be submitted due to network unavailability.
 *
 * Per refinement plan §19 "Should have":
 *   "offline report drafts and manual sync queue"
 *
 * Drafts are stored in localStorage and can be synced when connectivity
 * is restored. Each draft contains the report payload (without File objects,
 * which must be re-attached by the user before sync).
 */

const DRAFTS_KEY = "core_offline_report_drafts";

export type OfflineReportDraft = {
  id: string;
  incidentTitle: string;
  description: string;
  incidentType: string;
  locationText: string;
  latitude?: number | null;
  longitude?: number | null;
  aiConsent?: boolean;
  createdAt: string;
};

function loadDrafts(): OfflineReportDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: OfflineReportDraft[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function getOfflineDrafts(): OfflineReportDraft[] {
  return loadDrafts().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function saveOfflineDraft(draft: Omit<OfflineReportDraft, "id" | "createdAt">): OfflineReportDraft {
  const drafts = loadDrafts();
  const newDraft: OfflineReportDraft = {
    ...draft,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  drafts.push(newDraft);
  saveDrafts(drafts);
  return newDraft;
}

export function deleteOfflineDraft(id: string): void {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  saveDrafts(drafts);
}

export function getOfflineDraftCount(): number {
  return loadDrafts().length;
}
