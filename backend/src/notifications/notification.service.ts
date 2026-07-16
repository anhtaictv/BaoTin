import type { NotificationSender } from "./NotificationSender.js";

/// CONTEXT.md "Status" glossary — same Vietnamese labels used everywhere else a report's
/// status is shown (mobile-app-citizen/officer/dashboard-web theme.dart statusLabel()).
const STATUS_LABELS_VI: Record<string, string> = {
  pending: "Chờ xử lý",
  verifying: "Đang xác minh",
  confirmed_true: "Đúng sự thật",
  confirmed_false: "Tin sai",
};

export function createNotificationService(sender: NotificationSender) {
  async function notifyOfficerOfNewReport(officerId: string, reportId: string, urgent: boolean): Promise<Date> {
    const { sentAt } = await sender.send(officerId, {
      title: urgent ? "🚨 Tin báo khẩn cấp mới" : "Tin báo mới",
      body: `Có tin báo mới cần xác minh (mã: ${reportId}).`,
      data: { reportId, urgent: String(urgent) },
    });
    return sentAt;
  }

  /** The other direction of the same channel — a citizen only ever learned of a status
   * change by opening the app and checking themselves until now. */
  async function notifyUserOfStatusChange(userId: string, reportId: string, status: string): Promise<Date> {
    const label = STATUS_LABELS_VI[status] ?? status;
    const { sentAt } = await sender.send(userId, {
      title: "Cập nhật tin báo",
      body: `Tin báo của bạn (mã: ${reportId}) đã chuyển sang trạng thái: ${label}.`,
      data: { reportId, status },
    });
    return sentAt;
  }

  return { notifyOfficerOfNewReport, notifyUserOfStatusChange };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
