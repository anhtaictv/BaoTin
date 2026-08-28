import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadOldDistrictFeatures, mapFeatureToOldDistrictRow } from "./seed-old-districts.js";

// Runs from backend/ as cwd (vitest default) — data/raw/ lives one level up, at repo root.
const RAW_DIR = join(process.cwd(), "..", "data", "raw");
const DAK_LAK_PATH = join(RAW_DIR, "Đắk Lắk (phường xã) - 63.geojson");
const PHU_YEN_PATH = join(RAW_DIR, "Phú Yên (phường xã) - 63.geojson");

describe.skipIf(!existsSync(DAK_LAK_PATH) || !existsSync(PHU_YEN_PATH))(
  "seed-old-districts against the real 63-era geojson files",
  () => {
    it("loads all 184 old Đắk Lắk wards and 110 old Phú Yên wards", () => {
      expect(loadOldDistrictFeatures(DAK_LAK_PATH)).toHaveLength(184);
      expect(loadOldDistrictFeatures(PHU_YEN_PATH)).toHaveLength(110);
    });

    it("maps every real feature without throwing, and every geometry is MultiPolygon", () => {
      for (const path of [DAK_LAK_PATH, PHU_YEN_PATH]) {
        for (const feature of loadOldDistrictFeatures(path)) {
          expect(feature.geometry.type).toBe("MultiPolygon");
          const row = mapFeatureToOldDistrictRow(feature);
          expect(row.maTinh).toBeTruthy();
          expect(row.maXa).toBeTruthy();
          expect(row.tenXa).toBeTruthy();
        }
      }
    });

    it("has no duplicate (ma_tinh, ma_xa) codes within each province file", () => {
      for (const path of [DAK_LAK_PATH, PHU_YEN_PATH]) {
        const features = loadOldDistrictFeatures(path);
        const codes = features.map((f) => `${f.properties.ma_tinh}:${f.properties.ma_xa}`);
        expect(new Set(codes).size).toBe(codes.length);
      }
    });
  },
);
