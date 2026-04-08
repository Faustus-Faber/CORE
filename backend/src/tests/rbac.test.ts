import { describe, expect, it } from "vitest";

import { can, type PermissionAction } from "../utils/rbac.js";

describe("rbac permissions", () => {
  it("allows volunteers to update crisis status", () => {
    expect(can("VOLUNTEER", "UPDATE_CRISIS_STATUS")).toBe(true);
  });

  it("denies users from updating crisis status", () => {
    expect(can("USER", "UPDATE_CRISIS_STATUS")).toBe(false);
  });

  it("only allows admins in admin panel", () => {
    const action: PermissionAction = "ACCESS_ADMIN_PANEL";
    expect(can("ADMIN", action)).toBe(true);
    expect(can("USER", action)).toBe(false);
    expect(can("VOLUNTEER", action)).toBe(false);
  });
});
