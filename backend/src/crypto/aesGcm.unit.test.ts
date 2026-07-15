import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "./aesGcm.js";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

describe("aesGcm", () => {
  it("decrypts back to the original plaintext", () => {
    const plaintext = "0912345678";
    const encoded = encryptField(plaintext, KEY);
    expect(decryptField(encoded, KEY)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const plaintext = "Nguyễn Văn A";
    const first = encryptField(plaintext, KEY);
    const second = encryptField(plaintext, KEY);
    expect(first).not.toBe(second);
    expect(decryptField(first, KEY)).toBe(plaintext);
    expect(decryptField(second, KEY)).toBe(plaintext);
  });

  it("rejects a key that does not decode to 32 bytes", () => {
    expect(() => encryptField("x", Buffer.from("too-short").toString("base64"))).toThrow(
      /32 bytes/,
    );
  });

  it("throws on decrypt with the wrong key (GCM auth tag mismatch)", () => {
    const encoded = encryptField("secret", KEY);
    expect(() => decryptField(encoded, OTHER_KEY)).toThrow();
  });

  it("throws on a tampered ciphertext", () => {
    const encoded = encryptField("secret", KEY);
    const parts = encoded.split(":");
    const tamperedCiphertext = Buffer.from(parts[2]!, "base64");
    tamperedCiphertext[0] = tamperedCiphertext[0]! ^ 0xff;
    const tampered = [parts[0], parts[1], tamperedCiphertext.toString("base64")].join(":");
    expect(() => decryptField(tampered, KEY)).toThrow();
  });

  it("rejects a malformed encoded field", () => {
    expect(() => decryptField("not-the-right-shape", KEY)).toThrow(/Malformed/);
  });
});
