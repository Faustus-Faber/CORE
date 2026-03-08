import { describe, expect, it } from "vitest";

import { signAuthToken, verifyAuthToken } from "../utils/jwt.js";

describe("JWT remember-me behavior", () => {
  it("issues a token with shorter lifetime for default login", () => {
    const token = signAuthToken({ userId: "u1", role: "USER" }, false);
    const payload = verifyAuthToken(token);
    expect(payload.role).toBe("USER");
  });

  it("issues a token with longer lifetime when rememberMe is true", () => {
    const shortToken = signAuthToken({ userId: "u1", role: "USER" }, false);
    const longToken = signAuthToken({ userId: "u1", role: "USER" }, true);

    const shortPayload = verifyAuthToken(shortToken);
    const longPayload = verifyAuthToken(longToken);

    expect(shortPayload.exp).toBeDefined();
    expect(longPayload.exp).toBeDefined();
    expect(longPayload.exp!).toBeGreaterThan(shortPayload.exp!);
  });
});
