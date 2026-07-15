import { createHash, randomBytes } from "node:crypto";

/** Generates a high-entropy opaque refresh token (256 bits, url-safe base64). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Plain SHA-256 is appropriate here (unlike OTP hashing): the input is already a
 * uniformly-random 256-bit token, not a low-entropy 6-digit code, so there's nothing
 * for a pepper to protect against — brute-forcing the hash is infeasible regardless.
 * We hash it only so a DB read/backup leak doesn't hand out directly-usable tokens.
 */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
