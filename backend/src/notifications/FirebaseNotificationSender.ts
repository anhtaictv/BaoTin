import type { PrismaClient } from "@prisma/client";
import { initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import type { NotificationPayload, NotificationResult, NotificationSender } from "./NotificationSender.js";

export interface FirebaseNotificationSenderConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Real push notification provider — Firebase Cloud Messaging. The shared NotificationSender
 * interface only gives us a targetId (no "is this a citizen or an officer" hint), so the device
 * token is looked up by trying the officer table then the user table — the two id spaces never
 * collide (both are random UUIDs). A target with no token registered yet (app never opened, or
 * push permission denied) is a silent no-op, not an error: a push notification is a convenience
 * channel, never the record of truth — report/status state always lives in Postgres regardless
 * of whether the push actually reached a device.
 */
export class FirebaseNotificationSender implements NotificationSender {
  private readonly messaging: Messaging;

  constructor(
    private readonly prisma: Pick<PrismaClient, "user" | "officer">,
    config: FirebaseNotificationSenderConfig,
    app?: App,
  ) {
    this.messaging = getMessaging(
      app ??
        initializeApp({
          credential: cert({
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            // Service account PEM keys are usually handed over with literal "\n" sequences
            // (.env files, most secret managers) rather than real newlines.
            privateKey: config.privateKey.replace(/\\n/g, "\n"),
          }),
        }),
    );
  }

  async send(targetId: string, payload: NotificationPayload): Promise<NotificationResult> {
    const sentAt = new Date();
    const token = await this.lookupToken(targetId);
    if (token) {
      try {
        await this.messaging.send({
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
        });
      } catch (err) {
        // ponytail: swallow send failures (expired/rotated token, device offline) rather than
        // propagating — upgrade to pruning the stale token from the row if delivery rate ever
        // needs tracking.
        // eslint-disable-next-line no-console
        console.error(`[fcm] send failed for ${targetId}:`, err);
      }
    }
    return { sentAt };
  }

  private async lookupToken(targetId: string): Promise<string | null> {
    const officer = await this.prisma.officer.findUnique({ where: { id: targetId }, select: { fcmToken: true } });
    if (officer?.fcmToken) return officer.fcmToken;
    const user = await this.prisma.user.findUnique({ where: { id: targetId }, select: { fcmToken: true } });
    return user?.fcmToken ?? null;
  }
}
