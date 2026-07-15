import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashOpaqueToken } from "./tokenHash.js";

describe("tokenHash", () => {
  it("generates unique tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it("hashes deterministically so a stored hash can be matched on next use", () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it("hash never equals the raw token", () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).not.toBe(token);
  });
});
