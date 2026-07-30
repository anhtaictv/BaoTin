-- FCM device tokens for real push notifications (notifications/FirebaseNotificationSender.ts).
-- Registered by the mobile apps via POST /auth/device-token after login; null = not registered yet.
ALTER TABLE "users" ADD COLUMN "fcm_token" TEXT;
ALTER TABLE "officers" ADD COLUMN "fcm_token" TEXT;
