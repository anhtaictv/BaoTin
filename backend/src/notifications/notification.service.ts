import type { NotificationSender } from "./NotificationSender.js";

export function createNotificationService(sender: NotificationSender) {
  async function notifyOfficerOfNewReport(officerId: string, reportId: string, urgent: boolean): Promise<Date> {
    const { sentAt } = await sender.send(officerId, {
      title: urgent ? "🚨 Tin báo khẩn cấp mới" : "Tin báo mới",
      body: `Có tin báo mới cần xác minh (mã: ${reportId}).`,
      data: { reportId, urgent: String(urgent) },
    });
    return sentAt;
  }

  return { notifyOfficerOfNewReport };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
