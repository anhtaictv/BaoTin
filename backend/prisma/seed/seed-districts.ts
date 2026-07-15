import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

export interface DistrictFeatureProperties {
  ma_xa: string;
  ten_xa: string;
  /** Closest available field to DATABASE_SCHEMA.md's "parent_name" — see docs/adr note in plan. */
  sap_nhap?: string;
  loai?: string;
  dtich_km2?: number;
  dan_so?: number;
  ma_tinh?: string;
  ten_tinh?: string;
}

export interface DistrictGeoJsonFeature {
  type: "Feature";
  properties: DistrictFeatureProperties;
  geometry: { type: string; coordinates: unknown };
}

export interface DistrictGeoJsonCollection {
  type: "FeatureCollection";
  features: DistrictGeoJsonFeature[];
}

export interface DistrictRow {
  id: string;
  maXa: string;
  tenXa: string;
  parentName: string | null;
  loai: string | null;
  dtichKm2: number | null;
  danSo: number | null;
  geometryJson: string;
}

/** Pure mapping, independently testable without a DB or the real 16MB geojson file. */
export function mapFeatureToDistrictRow(feature: DistrictGeoJsonFeature): DistrictRow {
  const p = feature.properties;
  return {
    id: randomUUID(),
    maXa: p.ma_xa,
    tenXa: p.ten_xa,
    parentName: p.sap_nhap ?? null,
    loai: p.loai ?? null,
    dtichKm2: p.dtich_km2 ?? null,
    danSo: p.dan_so ?? null,
    geometryJson: JSON.stringify(feature.geometry),
  };
}

export function loadDistrictFeatures(geojsonPath: string): DistrictGeoJsonFeature[] {
  const raw = readFileSync(geojsonPath, "utf8");
  const collection = JSON.parse(raw) as DistrictGeoJsonCollection;
  return collection.features;
}

const BATCH_SIZE = 20;

/**
 * Inserts districts via parameterized $executeRaw (ST_GeomFromGeoJSON bound as a parameter,
 * never string-concatenated — see docs/adr/0001). ON CONFLICT (ma_xa) DO NOTHING makes
 * re-running the seed idempotent.
 */
export async function seedDistricts(prisma: PrismaClient, geojsonPath: string): Promise<number> {
  const features = loadDistrictFeatures(geojsonPath);
  const rows = features.map(mapFeatureToDistrictRow);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(
        (row) => prisma.$executeRaw`
          INSERT INTO districts (id, ma_xa, ten_xa, parent_name, loai, dtich_km2, dan_so, boundary)
          VALUES (
            ${row.id}::uuid, ${row.maXa}, ${row.tenXa}, ${row.parentName}, ${row.loai},
            ${row.dtichKm2}, ${row.danSo},
            ST_SetSRID(ST_GeomFromGeoJSON(${row.geometryJson}), 4326)
          )
          ON CONFLICT (ma_xa) DO NOTHING
        `,
      ),
    );
    // eslint-disable-next-line no-console
    console.log(`[seed-districts] ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  return rows.length;
}
