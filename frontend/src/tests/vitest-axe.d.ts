/**
 * Type augmentation for the `toHaveNoViolations` axe matcher (§14.6).
 *
 * vitest-axe ships a `Vi` namespace augmentation, but vitest 2.x exposes
 * its `Assertion` interface under the global `Chai` namespace. This local
 * declaration bridges the gap so `tsc --noEmit` type-checks the matcher.
 */

import type { AxeResults } from "axe-core";

declare global {
  namespace Chai {
    interface Assertion {
      toHaveNoViolations(): AxeResults;
    }
  }
}
