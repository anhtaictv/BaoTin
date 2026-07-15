import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // NIST-recommended GCM nonce length
const KEY_LENGTH_BYTES = 32; // AES-256

/**
 * Encrypts a UTF-8 string with AES-256-GCM. Returns "iv:tag:ciphertext" (all base64),
 * safe to store in a single text column. Never deterministic — encrypting the same
 * plaintext twice yields different output, so encrypted columns cannot be queried by
 * equality. Use src/crypto/phoneBlindIndex.ts for lookups instead.
 */
export function encryptField(plaintext: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Reverses encryptField. Throws if the payload was tampered with (GCM auth tag mismatch). */
export function decryptField(encoded: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted field: expected iv:tag:ciphertext");
  }
  const [ivB64, tagB64, ciphertextB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function decodeKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `PII encryption key must decode to ${KEY_LENGTH_BYTES} bytes, got ${key.length}. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
}
