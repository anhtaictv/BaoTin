import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPhoneNumber } from "./phoneBlindIndex.js";

const KEY = randomBytes(32).toString("base64");

describe("phoneBlindIndex", () => {
  it("is deterministic — same phone number always hashes the same", () => {
    expect(hashPhoneNumber("0912345678", KEY)).toBe(hashPhoneNumber("0912345678", KEY));
  });

  it("normalizes formatting before hashing", () => {
    expect(hashPhoneNumber("091 234 5678", KEY)).toBe(hashPhoneNumber("0912345678", KEY));
    expect(hashPhoneNumber("091-234-5678", KEY)).toBe(hashPhoneNumber("0912345678", KEY));
  });

  it("produces different hashes for different phone numbers", () => {
    expect(hashPhoneNumber("0912345678", KEY)).not.toBe(hashPhoneNumber("0912345679", KEY));
  });

  it("produces different hashes under different keys (not guessable without the key)", () => {
    const otherKey = randomBytes(32).toString("base64");
    expect(hashPhoneNumber("0912345678", KEY)).not.toBe(hashPhoneNumber("0912345678", otherKey));
  });
});
