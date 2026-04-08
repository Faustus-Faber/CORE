import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { asyncHandler } from "../middleware/asyncHandler.js";

describe("asyncHandler", () => {
  it("forwards async errors to next()", async () => {
    const nextMock = vi.fn();
    const next = nextMock as unknown as NextFunction;
    const handler = asyncHandler(async () => {
      throw new Error("boom");
    });

    handler({} as Request, {} as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(nextMock).toHaveBeenCalledTimes(1);
    expect(nextMock.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("does not call next on success", async () => {
    const nextMock = vi.fn();
    const next = nextMock as unknown as NextFunction;
    const handler = asyncHandler(async () => {
      return { ok: true };
    });

    handler({} as Request, {} as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(nextMock).not.toHaveBeenCalled();
  });
});
