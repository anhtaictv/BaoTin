import { describe, expect, it } from "vitest";
import { SEED_CAMERAS } from "./seed-cameras.js";

describe("SEED_CAMERAS", () => {
  it("every entry is clearly labeled as demo data", () => {
    for (const camera of SEED_CAMERAS) {
      expect(camera.name).toMatch(/^\[DEMO\]/);
    }
  });

  it("every entry has plausible lat/lng within Vietnam's bounds", () => {
    for (const camera of SEED_CAMERAS) {
      expect(camera.lat).toBeGreaterThan(8);
      expect(camera.lat).toBeLessThan(24);
      expect(camera.lng).toBeGreaterThan(102);
      expect(camera.lng).toBeLessThan(110);
    }
  });

  it("every entry references a ward seeded from the real Daklak.geojson dataset", () => {
    const realWardNames = new Set(["Buôn Ma Thuột", "Buôn Hồ", "Cư M’gar", "Cư Pơng"]);
    for (const camera of SEED_CAMERAS) {
      expect(realWardNames.has(camera.wardTenXa)).toBe(true);
    }
  });

  it("has no video/stream field on the spec — location + contact only (CLAUDE.md #8)", () => {
    for (const camera of SEED_CAMERAS) {
      expect(camera).not.toHaveProperty("streamUrl");
      expect(camera).not.toHaveProperty("videoUrl");
    }
  });

  it("every entry has a valid compass bearing and a positive field of view", () => {
    for (const camera of SEED_CAMERAS) {
      expect(camera.directionDegrees).toBeGreaterThanOrEqual(0);
      expect(camera.directionDegrees).toBeLessThan(360);
      expect(camera.fovDegrees).toBeGreaterThan(0);
      expect(camera.fovDegrees).toBeLessThanOrEqual(360);
    }
  });
});
