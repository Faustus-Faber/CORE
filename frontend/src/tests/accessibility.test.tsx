/**
 * Automated accessibility checks with axe-core (P1, §14.6).
 *
 * Runs axe against key presentational components to catch regressions in
 * ARIA semantics, color contrast, keyboard access, and labeling. These
 * checks complement (but do not replace) manual screen-reader testing.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import "vitest-axe/extend-expect";
import { I18nProvider } from "../i18n";
import { CrisisEventList } from "../components/CrisisEventList";
import { ErrorState } from "../components/ui/ErrorState";
import { LanguageToggle } from "../components/LanguageToggle";

expect.extend(matchers);

// Mock the API so CrisisEventList renders deterministic content without network.
vi.mock("../services/api", () => ({
  listCrisisEvents: vi.fn().mockResolvedValue([
    {
      id: "evt-1",
      canonicalId: null,
      title: "Flood in Sylhet",
      type: "FLOOD",
      severity: "HIGH",
      status: "ACTIVE",
      location: "Sylhet, Bangladesh",
      sitRep: null,
      latitude: null,
      longitude: null,
      reportCount: 3,
      reporterCount: 2,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]),
}));

describe("Accessibility (axe)", () => {
  it("CrisisEventList has no axe violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <I18nProvider>
          <CrisisEventList />
        </I18nProvider>
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ErrorState has no axe violations", async () => {
    const { container } = render(
      <ErrorState message="Something went wrong" detail="Network timeout" onRetry={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("LanguageToggle has no axe violations", async () => {
    const { container } = render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
