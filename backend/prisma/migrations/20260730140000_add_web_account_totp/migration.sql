-- TOTP 2FA for dashboard-web-react officer/admin accounts (SECURITY.md §3). totp_secret is
-- AES-256-GCM ciphertext (src/crypto/aesGcm.ts), never plaintext. totp_enabled defaults false
-- so every existing account is unaffected until an officer opts in via setup+confirm.
ALTER TABLE "web_accounts" ADD COLUMN "totp_secret" TEXT;
ALTER TABLE "web_accounts" ADD COLUMN "totp_enabled" BOOLEAN NOT NULL DEFAULT false;
