import { describe, expect, it } from "vitest";
import { mapFeatureToDistrictRow, type DistrictGeoJsonFeature } from "./seed-districts.js";

// Representative real feature shape from data/raw/Daklak.geojson (geometry truncated).
const SAMPLE_FEATURE: DistrictGeoJsonFeature = {
  type: "Feature",
  properties: {
    ma_xa: "24133",
    ten_xa: "Buôn Ma Thuột",
    sap_nhap: "Thành Công, Tân Tiến, Tân Thành, Tự An, Tân Lợi, Cư Êbur",
    loai: "Phường",
    dtich_km2: 71.99,
    dan_so: 169596,
    ma_tinh: "66",
    ten_tinh: "Đắk Lắk",
  },
  geometry: {
    type: "MultiPolygon",
    coordinates: [[[[108.05, 12.66], [108.06, 12.66], [108.06, 12.67], [108.05, 12.66]]]],
  },
};

describe("mapFeatureToDistrictRow", () => {
  it("maps GeoJSON properties onto the district row shape", () => {
    const row = mapFeatureToDistrictRow(SAMPLE_FEATURE);
    expect(row.maXa).toBe("24133");
    expect(row.tenXa).toBe("Buôn Ma Thuột");
    expect(row.parentName).toBe("Thành Công, Tân Tiến, Tân Thành, Tự An, Tân Lợi, Cư Êbur");
    expect(row.loai).toBe("Phường");
    expect(row.dtichKm2).toBe(71.99);
    expect(row.danSo).toBe(169596);
  });

  it("generates a valid v4 UUID id per row", () => {
    const row = mapFeatureToDistrictRow(SAMPLE_FEATURE);
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("serializes the geometry as JSON usable by ST_GeomFromGeoJSON", () => {
    const row = mapFeatureToDistrictRow(SAMPLE_FEATURE);
    expect(JSON.parse(row.geometryJson)).toEqual(SAMPLE_FEATURE.geometry);
  });

  it("defaults optional fields to null when absent from the source feature", () => {
    const minimal: DistrictGeoJsonFeature = {
      type: "Feature",
      properties: { ma_xa: "00000", ten_xa: "Test Ward" },
      geometry: { type: "MultiPolygon", coordinates: [] },
    };
    const row = mapFeatureToDistrictRow(minimal);
    expect(row.parentName).toBeNull();
    expect(row.loai).toBeNull();
    expect(row.dtichKm2).toBeNull();
    expect(row.danSo).toBeNull();
  });
});
