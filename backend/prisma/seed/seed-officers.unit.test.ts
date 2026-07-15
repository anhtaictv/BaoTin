import { describe, expect, it } from "vitest";
import { buildAutoOfficerSpec, SEED_OFFICERS } from "./seed-officers.js";

const PHONE_REGEX = /^0\d{9}$/; // matches backend/src/validation/schemas/auth.schema.ts

describe("buildAutoOfficerSpec", () => {
  it("generates a valid 10-digit phone number starting with 0", () => {
    const spec = buildAutoOfficerSpec({ id: "d1", tenXa: "Test Ward", loai: "Phường" }, 1);
    expect(spec.phoneNumber).toMatch(PHONE_REGEX);
  });

  it("generates distinct phone numbers for distinct sequence numbers", () => {
    const a = buildAutoOfficerSpec({ id: "d1", tenXa: "A", loai: "Phường" }, 1);
    const b = buildAutoOfficerSpec({ id: "d2", tenXa: "B", loai: "Xã" }, 2);
    expect(a.phoneNumber).not.toBe(b.phoneNumber);
  });

  it("never collides with the manually hand-picked SEED_OFFICERS phone range", () => {
    const manualNumbers = new Set(SEED_OFFICERS.map((o) => o.phoneNumber));
    for (let seq = 1; seq <= 102; seq++) {
      const spec = buildAutoOfficerSpec({ id: `d${seq}`, tenXa: `Ward ${seq}`, loai: "Phường" }, seq);
      expect(manualNumbers.has(spec.phoneNumber)).toBe(false);
    }
  });

  it("is clearly labeled as demo data and includes the ward name", () => {
    const spec = buildAutoOfficerSpec({ id: "d1", tenXa: "Cư Kty", loai: "Xã" }, 1);
    expect(spec.fullName).toMatch(/^\[DEMO\]/);
    expect(spec.fullName).toContain("Cư Kty");
    expect(spec.wardTenXa).toBe("Cư Kty");
  });

  it("falls back gracefully when loai is null", () => {
    const spec = buildAutoOfficerSpec({ id: "d1", tenXa: "Unknown Ward", loai: null }, 1);
    expect(spec.unitName).toBe("Công an Unknown Ward");
  });
});
