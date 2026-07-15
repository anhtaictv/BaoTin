export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  sentAt: Date;
}

/**
 * Pluggable send channel. No real push/SMS/Zalo OA provider has been chosen yet
 * (ROADMAP.md Giai đoạn 1) — production wiring picks a concrete implementation later
 * without touching call sites.
 */
export interface NotificationSender {
  send(targetId: string, payload: NotificationPayload): Promise<NotificationResult>;
}
