import { describe, expect, it } from "vitest";
import { generateTempPassword, hashPassword, verifyPassword } from "./passwordHash.js";

describe("passwordHash", () => {
  it("verifies a correct password against its stored hash", async () => {
    const stored = await hashPassword("Correct-Horse-1");
    expect(await verifyPassword("Correct-Horse-1", stored)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("Correct-Horse-1");
    expect(await verifyPassword("Wrong-Password-1", stored)).toBe(false);
  });

  it("never stores the password in plaintext form", async () => {
    const stored = await hashPassword("Correct-Horse-1");
    expect(stored).not.toContain("Correct-Horse-1");
  });

  it("produces a different hash each time (random salt) even for the same password", async () => {
    const a = await hashPassword("Correct-Horse-1");
    const b = await hashPassword("Correct-Horse-1");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Correct-Horse-1", a)).toBe(true);
    expect(await verifyPassword("Correct-Horse-1", b)).toBe(true);
  });

  it("stores as saltHex:hashHex", async () => {
    const stored = await hashPassword("Correct-Horse-1");
    expect(stored.split(":")).toHaveLength(2);
  });

  it("fails closed (false, not throw) on a malformed stored value", async () => {
    await expect(verifyPassword("anything", "not-a-valid-stored-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});

describe("generateTempPassword", () => {
  it("generates a password of the requested length", () => {
    expect(generateTempPassword(10)).toHaveLength(10);
    expect(generateTempPassword(16)).toHaveLength(16);
  });

  it("defaults to length 10", () => {
    expect(generateTempPassword()).toHaveLength(10);
  });

  it("only uses unambiguous alphanumeric characters (no 0/O/1/l/I)", () => {
    for (let i = 0; i < 20; i++) {
      const password = generateTempPassword(30);
      expect(password).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]+$/);
    }
  });

  it("generates different passwords across calls", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).not.toBe(b);
  });
});
