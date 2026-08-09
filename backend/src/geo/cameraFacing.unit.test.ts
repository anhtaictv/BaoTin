import { describe, expect, it } from "vitest";
import { isFacingBearing } from "./cameraFacing.js";

describe("isFacingBearing", () => {
  it("returns true when the bearing sits inside the field of view", () => {
    expect(isFacingBearing(135, 80, 135)).toBe(true);
    expect(isFacingBearing(135, 80, 100)).toBe(true);
    expect(isFacingBearing(135, 80, 174)).toBe(true);
  });

  it("returns false when the bearing sits outside the field of view", () => {
    expect(isFacingBearing(135, 80, 0)).toBe(false);
    expect(isFacingBearing(135, 80, 270)).toBe(false);
  });

  it("handles wraparound near 0°/360° correctly", () => {
    // direction=350°, fov=60° => range is 320°..(360/0)..20°
    expect(isFacingBearing(350, 60, 10)).toBe(true);
    expect(isFacingBearing(350, 60, 330)).toBe(true);
    expect(isFacingBearing(350, 60, 180)).toBe(false);
  });

  it("is inclusive at the exact edge of the field of view", () => {
    expect(isFacingBearing(0, 80, 40)).toBe(true);
    expect(isFacingBearing(0, 80, 41)).toBe(false);
  });
});
