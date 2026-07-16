import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createNotificationService } from "./notification.service.js";
import type { NotificationSender, NotificationPayload } from "./NotificationSender.js";

function buildSender() {
  const calls: { targetId: string; payload: NotificationPayload }[] = [];
  const sender: NotificationSender = {
    async send(targetId, payload) {
      calls.push({ targetId, payload });
      return { sentAt: new Date() };
    },
  };
  return { sender, calls };
}

describe("notification.service — notifyOfficerOfNewReport", () => {
  it("marks the title urgent for an emergency report", async () => {
    const { sender, calls } = buildSender();
    const service = createNotificationService(sender);
    const officerId = randomUUID();
    const reportId = randomUUID();

    await service.notifyOfficerOfNewReport(officerId, reportId, true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.targetId).toBe(officerId);
    expect(calls[0]?.payload.title).toContain("khẩn cấp");
    expect(calls[0]?.payload.data).toEqual({ reportId, urgent: "true" });
  });

  it("uses a plain title for a normal report", async () => {
    const { sender, calls } = buildSender();
    const service = createNotificationService(sender);

    await service.notifyOfficerOfNewReport(randomUUID(), randomUUID(), false);

    expect(calls[0]?.payload.title).not.toContain("khẩn cấp");
  });
});

describe("notification.service — notifyUserOfStatusChange", () => {
  it("renders the Vietnamese label for a known status", async () => {
    const { sender, calls } = buildSender();
    const service = createNotificationService(sender);
    const userId = randomUUID();
    const reportId = randomUUID();

    await service.notifyUserOfStatusChange(userId, reportId, "confirmed_true");

    expect(calls[0]?.targetId).toBe(userId);
    expect(calls[0]?.payload.body).toContain("Đúng sự thật");
    expect(calls[0]?.payload.data).toEqual({ reportId, status: "confirmed_true" });
  });

  it("falls back to the raw status string when there's no known label", async () => {
    const { sender, calls } = buildSender();
    const service = createNotificationService(sender);

    await service.notifyUserOfStatusChange(randomUUID(), randomUUID(), "some_future_status");

    expect(calls[0]?.payload.body).toContain("some_future_status");
  });
});
