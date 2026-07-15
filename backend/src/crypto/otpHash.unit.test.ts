import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, verifyOtp } from "./otpHash.js";

const PEPPER = "test-pepper";

describe("otpHash", () => {
  it("generates a 6-digit, zero-padded OTP", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it("verifies a correct OTP against its stored hash", () => {
    const otp = "004821";
    const stored = hashOtp(otp, PEPPER);
    expect(verifyOtp(otp, stored, PEPPER)).toBe(true);
  });

  it("rejects an incorrect OTP", () => {
    const stored = hashOtp("004821", PEPPER);
    expect(verifyOtp("999999", stored, PEPPER)).toBe(false);
  });

  it("rejects the correct OTP hashed under a different pepper", () => {
    const stored = hashOtp("004821", PEPPER);
    expect(verifyOtp("004821", stored, "different-pepper")).toBe(false);
  });

  it("never stores the OTP in plaintext form (hash differs from input)", () => {
    const otp = "004821";
    expect(hashOtp(otp, PEPPER)).not.toBe(otp);
  });
});
