import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

// Mock the firebase-admin SDK entirely — these tests must never contact real Firebase.
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(() => ({ name: "fake-app" })),
  cert: vi.fn((config) => config),
}));
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: vi.fn(() => ({ send: sendMock })),
}));

const { FirebaseNotificationSender } = await import("./FirebaseNotificationSender.js");

function buildPrisma(officer: { fcmToken: string | null } | null, user: { fcmToken: string | null } | null) {
  return {
    officer: { findUnique: vi.fn(async () => officer) },
    user: { findUnique: vi.fn(async () => user) },
  } as any;
}

const CONFIG = { projectId: "test-project", clientEmail: "svc@test.iam.gserviceaccount.com", privateKey: "fake-key" };

describe("FirebaseNotificationSender", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue("message-id");
  });

  it("sends via the officer's token when the targetId matches an officer row", async () => {
    const prisma = buildPrisma({ fcmToken: "officer-token" }, null);
    const sender = new FirebaseNotificationSender(prisma, CONFIG);

    await sender.send("some-id", { title: "Tin mới", body: "Có tin báo mới", data: { reportId: "r1" } });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({
      token: "officer-token",
      notification: { title: "Tin mới", body: "Có tin báo mới" },
      data: { reportId: "r1" },
    });
  });

  it("falls back to the user's token when there's no matching officer row", async () => {
    const prisma = buildPrisma(null, { fcmToken: "citizen-token" });
    const sender = new FirebaseNotificationSender(prisma, CONFIG);

    await sender.send("some-id", { title: "Cập nhật", body: "Trạng thái đã đổi" });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({ token: "citizen-token" });
  });

  it("no-ops without calling messaging.send when neither row has a token", async () => {
    const prisma = buildPrisma(null, null);
    const sender = new FirebaseNotificationSender(prisma, CONFIG);

    const result = await sender.send("unknown-id", { title: "t", body: "b" });

    expect(sendMock).not.toHaveBeenCalled();
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("fails open (does not throw) when messaging.send rejects", async () => {
    sendMock.mockRejectedValueOnce(new Error("registration-token-not-registered"));
    const prisma = buildPrisma({ fcmToken: "stale-token" }, null);
    const sender = new FirebaseNotificationSender(prisma, CONFIG);

    await expect(sender.send("some-id", { title: "t", body: "b" })).resolves.toMatchObject({
      sentAt: expect.any(Date),
    });
  });
});
