import { describe, expect, it } from "vitest";
import { mapFeatureToOldDistrictRow, type OldDistrictGeoJsonFeature } from "./seed-old-districts.js";

// Representative real feature shape from data/raw/"Đắk Lắk (phường xã) - 63.geojson".
const SAMPLE_FEATURE: OldDistrictGeoJsonFeature = {
  type: "Feature",
  properties: {
    ma_tinh: "66",
    ma_xa: "24247",
    ten_xa: "Cuôr KNia",
    ma_huyen: "647",
    ten_huyen: "Buôn Đôn",
    ten_tinh: "Đắk Lắk",
    loai: "Xã",
  },
  geometry: {
    type: "MultiPolygon",
    coordinates: [[[[108.0, 12.7], [108.01, 12.7], [108.01, 12.71], [108.0, 12.7]]]],
  },
};

describe("mapFeatureToOldDistrictRow", () => {
  it("maps GeoJSON properties onto the old-district row shape", () => {
    const row = mapFeatureToOldDistrictRow(SAMPLE_FEATURE);
    expect(row.maTinh).toBe("66");
    expect(row.maXa).toBe("24247");
    expect(row.tenXa).toBe("Cuôr KNia");
    expect(row.maHuyen).toBe("647");
    expect(row.tenHuyen).toBe("Buôn Đôn");
    expect(row.tenTinh).toBe("Đắk Lắk");
    expect(row.loai).toBe("Xã");
  });

  it("generates a valid v4 UUID id per row", () => {
    const row = mapFeatureToOldDistrictRow(SAMPLE_FEATURE);
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("serializes the geometry as JSON usable by ST_GeomFromGeoJSON", () => {
    const row = mapFeatureToOldDistrictRow(SAMPLE_FEATURE);
    expect(JSON.parse(row.geometryJson)).toEqual(SAMPLE_FEATURE.geometry);
  });

  it("defaults optional fields to null when absent from the source feature", () => {
    const minimal: OldDistrictGeoJsonFeature = {
      type: "Feature",
      properties: { ma_tinh: "54", ma_xa: "00000", ten_xa: "Test Ward" },
      geometry: { type: "MultiPolygon", coordinates: [] },
    };
    const row = mapFeatureToOldDistrictRow(minimal);
    expect(row.maHuyen).toBeNull();
    expect(row.tenHuyen).toBeNull();
    expect(row.tenTinh).toBeNull();
    expect(row.loai).toBeNull();
  });
});
