import type { PrismaClient } from "@prisma/client";

/**
 * PostGIS ST_Contains geo-matching. Point order is (lng, lat) — ST_MakePoint takes X,Y,
 * i.e. longitude first — a common source of bugs, hence the named parameters below rather
 * than positional (lat, lng). Requires a live Postgres+PostGIS connection; not unit-testable
 * without one, see docs/adr/0001-postgis-geometry-via-unsupported-raw-sql.md.
 */
export function createGeoMatchService(prisma: PrismaClient) {
  async function matchDistrict(params: { lat: number; lng: number }): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM districts
      WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326))
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  return { matchDistrict };
}

export type GeoMatchService = ReturnType<typeof createGeoMatchService>;
