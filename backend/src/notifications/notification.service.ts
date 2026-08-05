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

  /** Same channel as notifyOfficerOfNewReport — a detected-accident alert still needs an
   * officer to look at it and confirm/dismiss (human-in-the-loop, CLAUDE.md #3), so it gets
   * the same nudge a citizen report would. */
  async function notifyOfficerOfAccidentAlert(officerId: string, alertId: string): Promise<Date> {
    const { sentAt } = await sender.send(officerId, {
      title: "🚧 Cảnh báo tai nạn giao thông",
      body: `Camera phát hiện khả năng có tai nạn (mã: ${alertId}) — cần xác nhận.`,
      data: { alertId },
    });
    return sentAt;
  }

  /** Chat between đơn vị (bottom-nav "Chat" tab) — one push per other channel member, fired
   * from chat.service.ts after the message row is persisted. `channelLabel` is already the
   * Vietnamese display string ("Chung" or the district's tên xã) so this stays free of any
   * lookup of its own. */
  async function notifyOfficerOfChatMessage(
    officerId: string,
    senderName: string,
    channelLabel: string,
    preview: string,
  ): Promise<Date> {
    const { sentAt } = await sender.send(officerId, {
      title: `💬 ${senderName} — ${channelLabel}`,
      body: preview,
      data: { channelLabel },
    });
    return sentAt;
  }

  /** Geo-fence alert (broadcast theo địa bàn) — pushed to citizens who've reported in the
   * target district recently (broadcastAlerts.service.ts), alongside the pull-based
   * `recentBroadcasts` in GET /area-alerts. `districtName` is already the Vietnamese tên xã
   * (resolved by the caller), same pattern as notifyOfficerOfChatMessage's channelLabel. */
  async function notifyUserOfDistrictBroadcast(userId: string, message: string, districtName: string): Promise<Date> {
    const { sentAt } = await sender.send(userId, {
      title: `📢 Cảnh báo khu vực — ${districtName}`,
      body: message,
      data: { districtName },
    });
    return sentAt;
  }

  return {
    notifyOfficerOfNewReport,
    notifyUserOfStatusChange,
    notifyOfficerOfAccidentAlert,
    notifyOfficerOfChatMessage,
    notifyUserOfDistrictBroadcast,
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
