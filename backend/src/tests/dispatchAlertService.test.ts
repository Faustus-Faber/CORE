import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  crisisEvent: {
    findUnique: vi.fn()
  },
  user: {
    findMany: vi.fn()
  },
  dispatchAlertLog: {
    findFirst: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock("../config/env.js", () => ({
  env: {
    brevoApiKey: "brevo_test_key",
    brevoFromName: "CORE Dispatch",
    brevoFromEmail: "dispatch@core.local",
    corsOrigins: ["http://localhost:5173"]
  }
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock
}));

import { triggerDispatchAlertsForCrisis } from "../services/dispatchAlertService.js";

function mockJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("triggerDispatchAlertsForCrisis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips alert dispatch when crisis is not HIGH or CRITICAL", async () => {
    prismaMock.crisisEvent.findUnique.mockResolvedValue({
      id: "507f1f77bcf86cd799439013",
      title: "Minor Incident",
      severityLevel: "MEDIUM",
      latitude: 23.8103,
      longitude: 90.4125
    });

    await triggerDispatchAlertsForCrisis("507f1f77bcf86cd799439013");

    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.dispatchAlertLog.create).not.toHaveBeenCalled();
  });

  it("sends dispatch email to in-range opted-in volunteers and logs delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({ messageId: "brevo-msg-1" })
    );
    vi.stubGlobal("fetch", fetchMock);

    prismaMock.crisisEvent.findUnique.mockResolvedValue({
      id: "507f1f77bcf86cd799439013",
      title: "Severe Flood",
      severityLevel: "CRITICAL",
      locationText: "Dhaka",
      sitRepText: "Water level rising rapidly near multiple blocks.",
      latitude: 23.8103,
      longitude: 90.4125
    });
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "507f1f77bcf86cd799439012",
        email: "volunteer@core.local",
        latitude: 23.8111,
        longitude: 90.4131
      }
    ]);
    prismaMock.dispatchAlertLog.findFirst.mockResolvedValue(null);
    prismaMock.dispatchAlertLog.groupBy.mockResolvedValue([]);
    prismaMock.dispatchAlertLog.create.mockResolvedValue({});

    await triggerDispatchAlertsForCrisis("507f1f77bcf86cd799439013");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.brevo.com/v3/smtp/email");
    expect(prismaMock.dispatchAlertLog.create).toHaveBeenCalledWith({
      data: {
        userId: "507f1f77bcf86cd799439012",
        crisisEventId: "507f1f77bcf86cd799439013",
        emailMasked: "vo****@core.local",
        status: "SENT",
        providerMessageId: "brevo-msg-1",
        errorMessage: null
      }
    });
  });
});
