import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/** Hashes a password with a random salt (scrypt, Node's built-in KDF — no extra dependency,
 * same "use node:crypto" style as otpHash.ts/tokenHash.ts). Stored as "saltHex:hashHex" so
 * verifyPassword doesn't need a separate salt column. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/** Constant-time comparison against a stored hash — avoids leaking match progress via timing,
 * same rationale as otpHash.ts's verifyOtp. Returns false (never throws) on a malformed
 * stored value so a corrupt row fails closed instead of crashing the login request. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const candidate = (await scryptAsync(plain, salt, expected.length)) as Buffer;
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Generates a temporary password for newly-provisioned/reset accounts — random, typeable
 * (no ambiguous-looking characters), handed off once and never stored in plaintext. */
export function generateTempPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i]! % alphabet.length];
  }
  return result;
}
