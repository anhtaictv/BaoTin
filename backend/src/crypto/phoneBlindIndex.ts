import { createHmac } from "node:crypto";

/**
 * Deterministic HMAC-SHA256 "blind index" for phone numbers. Not reversible (unlike
 * encryptField), but equal inputs always produce equal output — this is what lets
 * OTP request/verify and officer login do `WHERE phone_hash = ?` while the actual
 * phone_number stays AES-256-GCM encrypted (which is intentionally non-deterministic
 * and therefore not queryable). See docs/adr and SECURITY.md §2.2.
 */
export function hashPhoneNumber(phoneNumber: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  return createHmac("sha256", key).update(normalizePhoneNumber(phoneNumber)).digest("hex");
}

/** Strips formatting so "090 000 0001" and "090-000-0001" hash identically. */
export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[\s\-()]/g, "");
}
