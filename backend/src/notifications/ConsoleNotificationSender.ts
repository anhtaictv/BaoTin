import type { NotificationPayload, NotificationResult, NotificationSender } from "./NotificationSender.js";

/** Structured-log stub — stands in until a real push/SMS provider is chosen. */
export class ConsoleNotificationSender implements NotificationSender {
  async send(targetId: string, payload: NotificationPayload): Promise<NotificationResult> {
    const sentAt = new Date();
    // eslint-disable-next-line no-console
    console.log(
      `[notification-stub] -> ${targetId} @ ${sentAt.toISOString()}: ${payload.title} — ${payload.body}`,
      payload.data ?? {},
    );
    return { sentAt };
  }
}
