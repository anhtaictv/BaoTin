import { describe, expect, it } from "vitest";
import { computeHeatByDistrict, heatLevelFor } from "./signalHeat.js";

describe("signalHeat — heatLevelFor", () => {
  it("buckets score into low/medium/high", () => {
    expect(heatLevelFor(0)).toBe("low");
    expect(heatLevelFor(1)).toBe("low");
    expect(heatLevelFor(2)).toBe("medium");
    expect(heatLevelFor(4)).toBe("medium");
    expect(heatLevelFor(5)).toBe("high");
    expect(heatLevelFor(20)).toBe("high");
  });
});

describe("signalHeat — computeHeatByDistrict", () => {
  it("counts only signals within the lookback window, per district", () => {
    const now = new Date();
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const signals = [
      { districtId: "d1", crawledAt: now, publishedAt: now },
      { districtId: "d1", crawledAt: now, publishedAt: now },
      { districtId: "d1", crawledAt: old, publishedAt: old },
      { districtId: "d2", crawledAt: now, publishedAt: now },
    ];

    const result = computeHeatByDistrict(signals);

    expect(result.get("d1")).toEqual({ score: 2, level: "medium" });
    expect(result.get("d2")).toEqual({ score: 1, level: "low" });
  });

  it("ignores signals with no district", () => {
    const now = new Date();
    const result = computeHeatByDistrict([{ districtId: null, crawledAt: now, publishedAt: now }]);
    expect(result.size).toBe(0);
  });

  it("falls back to crawledAt when publishedAt is null", () => {
    const now = new Date();
    const result = computeHeatByDistrict([{ districtId: "d1", crawledAt: now, publishedAt: null }]);
    expect(result.get("d1")?.score).toBe(1);
  });
});
