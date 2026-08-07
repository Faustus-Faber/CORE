import { describe, it, expect, beforeEach } from "vitest";
import {
  saveOfflineDraft,
  getOfflineDrafts,
  deleteOfflineDraft,
  getOfflineDraftCount,
} from "../utils/offlineDrafts";

describe("offlineDrafts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with zero drafts", () => {
    expect(getOfflineDraftCount()).toBe(0);
    expect(getOfflineDrafts()).toEqual([]);
  });

  it("saves and retrieves a draft", () => {
    const draft = saveOfflineDraft({
      incidentTitle: "Test Flood",
      description: "Water rising",
      incidentType: "FLOOD",
      locationText: "Dhaka",
      latitude: 23.81,
      longitude: 90.41,
      aiConsent: true,
    });

    expect(draft.id).toBeTruthy();
    expect(draft.createdAt).toBeTruthy();
    expect(getOfflineDraftCount()).toBe(1);

    const drafts = getOfflineDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].incidentTitle).toBe("Test Flood");
  });

  it("deletes a draft by id", () => {
    const draft = saveOfflineDraft({
      incidentTitle: "Test",
      description: "desc",
      incidentType: "FIRE",
      locationText: "Here",
    });

    expect(getOfflineDraftCount()).toBe(1);
    deleteOfflineDraft(draft.id);
    expect(getOfflineDraftCount()).toBe(0);
  });

  it("handles multiple drafts sorted by createdAt", () => {
    saveOfflineDraft({
      incidentTitle: "First",
      description: "d",
      incidentType: "FLOOD",
      locationText: "A",
    });

    // Small delay to ensure different timestamps
    const second = saveOfflineDraft({
      incidentTitle: "Second",
      description: "d",
      incidentType: "FIRE",
      locationText: "B",
    });

    const drafts = getOfflineDrafts();
    expect(drafts).toHaveLength(2);
    // Sorted ascending by createdAt — second should be after first
    expect(drafts[1].incidentTitle).toBe("Second");
  });
});
