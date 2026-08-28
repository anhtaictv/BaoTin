import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

export interface OldDistrictFeatureProperties {
  ma_tinh: string;
  ma_xa: string;
  ten_xa: string;
  ma_huyen?: string;
  ten_huyen?: string;
  ten_tinh?: string;
  loai?: string;
}

export interface OldDistrictGeoJsonFeature {
  type: "Feature";
  properties: OldDistrictFeatureProperties;
  geometry: { type: string; coordinates: unknown };
}

export interface OldDistrictGeoJsonCollection {
  type: "FeatureCollection";
  features: OldDistrictGeoJsonFeature[];
}

export interface OldDistrictRow {
  id: string;
  maTinh: string;
  maXa: string;
  tenXa: string;
  maHuyen: string | null;
  tenHuyen: string | null;
  tenTinh: string | null;
  loai: string | null;
  geometryJson: string;
}

/** Pure mapping, independently testable without a DB or the real geojson files. */
export function mapFeatureToOldDistrictRow(feature: OldDistrictGeoJsonFeature): OldDistrictRow {
  const p = feature.properties;
  return {
    id: randomUUID(),
    maTinh: p.ma_tinh,
    maXa: p.ma_xa,
    tenXa: p.ten_xa,
    maHuyen: p.ma_huyen ?? null,
    tenHuyen: p.ten_huyen ?? null,
    tenTinh: p.ten_tinh ?? null,
    loai: p.loai ?? null,
    geometryJson: JSON.stringify(feature.geometry),
  };
}

export function loadOldDistrictFeatures(geojsonPath: string): OldDistrictGeoJsonFeature[] {
  const raw = readFileSync(geojsonPath, "utf8");
  const collection = JSON.parse(raw) as OldDistrictGeoJsonCollection;
  return collection.features;
}

const BATCH_SIZE = 20;

/**
 * Inserts old (pre-2025-merger, "63 tỉnh thành") ward boundaries via parameterized
 * $executeRaw, same ST_GeomFromGeoJSON pattern as seed-districts.ts. ON CONFLICT
 * (ma_tinh, ma_xa) DO NOTHING makes re-running idempotent. Call once per province file —
 * "Đắk Lắk (phường xã) - 63.geojson" (184 xã, superset of the per-huyện files) and
 * "Phú Yên (phường xã) - 63.geojson" (110 xã) cover the whole merged new Đắk Lắk province.
 */
export async function seedOldDistricts(prisma: PrismaClient, geojsonPath: string): Promise<number> {
  const features = loadOldDistrictFeatures(geojsonPath);
  const rows = features.map(mapFeatureToOldDistrictRow);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(
        (row) => prisma.$executeRaw`
          INSERT INTO old_districts (id, ma_tinh, ma_xa, ten_xa, ma_huyen, ten_huyen, ten_tinh, loai, boundary)
          VALUES (
            ${row.id}::uuid, ${row.maTinh}, ${row.maXa}, ${row.tenXa}, ${row.maHuyen}, ${row.tenHuyen}, ${row.tenTinh}, ${row.loai},
            ST_SetSRID(ST_GeomFromGeoJSON(${row.geometryJson}), 4326)
          )
          ON CONFLICT (ma_tinh, ma_xa) DO NOTHING
        `,
      ),
    );
    // eslint-disable-next-line no-console
    console.log(`[seed-old-districts] ${geojsonPath}: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  return rows.length;
}
