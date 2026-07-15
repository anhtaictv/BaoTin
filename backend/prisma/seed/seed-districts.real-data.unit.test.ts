import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDistrictFeatures, mapFeatureToDistrictRow } from "./seed-districts.js";

// Runs from backend/ as cwd (vitest default) — data/raw/ lives one level up, at repo root.
const GEOJSON_PATH = join(process.cwd(), "..", "data", "raw", "Daklak.geojson");

describe.skipIf(!existsSync(GEOJSON_PATH))("seed-districts against the real Daklak.geojson", () => {
  it("loads all 102 real ward/commune features", () => {
    const features = loadDistrictFeatures(GEOJSON_PATH);
    expect(features).toHaveLength(102);
  });

  it("maps every real feature without throwing, and every geometry is MultiPolygon", () => {
    const features = loadDistrictFeatures(GEOJSON_PATH);
    for (const feature of features) {
      expect(feature.geometry.type).toBe("MultiPolygon");
      const row = mapFeatureToDistrictRow(feature);
      expect(row.maXa).toBeTruthy();
      expect(row.tenXa).toBeTruthy();
    }
  });

  it("includes the real Buôn Ma Thuột ward used by seed-officers.ts", () => {
    const features = loadDistrictFeatures(GEOJSON_PATH);
    const bmt = features.find((f) => f.properties.ten_xa === "Buôn Ma Thuột");
    expect(bmt).toBeDefined();
    expect(bmt?.properties.ten_tinh).toBe("Đắk Lắk");
  });

  it("has no duplicate ma_xa codes (unique constraint assumption holds)", () => {
    const features = loadDistrictFeatures(GEOJSON_PATH);
    const codes = features.map((f) => f.properties.ma_xa);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
