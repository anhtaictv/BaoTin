import type { PrismaClient } from "@prisma/client";

/**
 * Below this share of an old ward's area, the overlap is boundary-digitization noise (a
 * sliver along the edge), not a real "part of this old ward now belongs to this new
 * district" split — see the "Phường 9 (1 phần)" case in Daklak.geojson's sap_nhap text,
 * which genuinely does split. Filtering keeps the picker communeAssignment.service.ts
 * offers trưởng xã free of spurious 0.1%-overlap entries.
 */
export const MIN_OVERLAP_RATIO = 0.02;

/**
 * One-time spatial join (ST_Intersection over old_districts x districts, both already
 * seeded — see seed-old-districts.ts / seed-districts.ts) computing which new District(s)
 * each old (pre-2025-merger) ward now falls inside, by overlap area. Pure PostGIS, not
 * unit-testable without a live Postgres+PostGIS connection — same rationale as
 * geoMatch.service.ts (docs/adr/0001). Idempotent via ON CONFLICT.
 */
export async function seedOldDistrictOverlaps(prisma: PrismaClient): Promise<number> {
  const result = await prisma.$executeRaw`
    INSERT INTO old_district_overlaps (id, old_district_id, district_id, overlap_area_km2, overlap_ratio)
    SELECT
      uuid_generate_v4(),
      od.id,
      d.id,
      ST_Area(ST_Intersection(od.boundary, d.boundary)::geography) / 1e6,
      ST_Area(ST_Intersection(od.boundary, d.boundary)::geography)
        / NULLIF(ST_Area(od.boundary::geography), 0)
    FROM old_districts od
    JOIN districts d ON ST_Intersects(od.boundary, d.boundary)
    WHERE ST_Area(ST_Intersection(od.boundary, d.boundary)::geography)
        / NULLIF(ST_Area(od.boundary::geography), 0) >= ${MIN_OVERLAP_RATIO}
    ON CONFLICT (old_district_id, district_id) DO NOTHING
  `;
  return Number(result);
}
