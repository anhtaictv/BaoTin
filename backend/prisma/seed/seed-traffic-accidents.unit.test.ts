import { describe, expect, it } from "vitest";
import { SEED_TRAFFIC_ACCIDENTS } from "./seed-traffic-accidents.js";
import { SEED_CAMERAS } from "./seed-cameras.js";

describe("SEED_TRAFFIC_ACCIDENTS", () => {
  it("every entry references a camera seeded by seed-cameras.ts", () => {
    const realCameraNames = new Set(SEED_CAMERAS.map((c) => c.name));
    for (const accident of SEED_TRAFFIC_ACCIDENTS) {
      expect(realCameraNames.has(accident.cameraName)).toBe(true);
    }
  });

  it("every entry has a valid TrafficAccidentAlertStatus", () => {
    for (const accident of SEED_TRAFFIC_ACCIDENTS) {
      expect(["pending", "confirmed", "dismissed"]).toContain(accident.status);
    }
  });

  it("plate numbers look like real Vietnamese plates when present (Đắk Lắk prefix 47)", () => {
    for (const accident of SEED_TRAFFIC_ACCIDENTS) {
      for (const plate of accident.plateNumbers) {
        expect(plate).toMatch(/^47[A-Z]\d?-\d{3}\.\d{2}$/);
      }
    }
  });

  it("covers at least one of each status, to demo the full alert lifecycle", () => {
    const statuses = new Set(SEED_TRAFFIC_ACCIDENTS.map((a) => a.status));
    expect(statuses).toEqual(new Set(["pending", "confirmed", "dismissed"]));
  });

  it("has no video/stream field on the spec — camera-only detection, never footage (CLAUDE.md #8)", () => {
    for (const accident of SEED_TRAFFIC_ACCIDENTS) {
      expect(accident).not.toHaveProperty("streamUrl");
      expect(accident).not.toHaveProperty("videoUrl");
    }
  });
});
