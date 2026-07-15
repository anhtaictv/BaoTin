import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** Generates a 6-digit OTP, zero-padded (e.g. "004821"). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hashes an OTP with a server-side pepper. Never store the raw OTP — see SECURITY.md §1.2. */
export function hashOtp(otp: string, pepper: string): string {
  return createHmac("sha256", pepper).update(otp).digest("hex");
}

/** Constant-time comparison against a stored hash — avoids leaking match progress via timing. */
export function verifyOtp(otp: string, storedHash: string, pepper: string): boolean {
  const candidate = Buffer.from(hashOtp(otp, pepper), "hex");
  const expected = Buffer.from(storedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
