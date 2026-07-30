import type { PrismaClient } from "@prisma/client";
import type { Cache } from "../cache/cache.js";

/** Districts are seed/admin-provisioned and essentially never change at runtime (ROADMAP.md —
 * boundary GeoJSON is loaded once, not edited by any running feature), so a few minutes of
 * staleness after a boundary edit is an acceptable trade for skipping a PostGIS round trip on
 * every geo-match call. */
const DISTRICT_MATCH_CACHE_TTL_SECONDS = 300;

/**
 * PostGIS ST_Contains geo-matching. Point order is (lng, lat) — ST_MakePoint takes X,Y,
 * i.e. longitude first — a common source of bugs, hence the named parameters below rather
 * than positional (lat, lng). Requires a live Postgres+PostGIS connection; not unit-testable
 * without one, see docs/adr/0001-postgis-geometry-via-unsupported-raw-sql.md.
 *
 * `cache` is optional so existing call sites/tests that construct this service directly keep
 * working unchanged. When given, each exact (lat,lng) pair's result — just a plain `{id}` row,
 * not a live geometry value — is cached for a few minutes.
 * ponytail: cache key is the exact coordinate pair, no rounding/geohash bucketing, so a hit only
 * happens for a literal repeat of the same point (e.g. demo/seed data, retried submissions).
 * That keeps the result always exactly what PostGIS itself would return (no precision trade-off
 * near a district boundary). Upgrade to geohash-bucketed keys if hit rate on real GPS traffic
 * ever needs to be higher than that.
 */
export function createGeoMatchService(prisma: PrismaClient, cache?: Cache) {
  async function matchDistrict(params: { lat: number; lng: number }): Promise<string | null> {
    const run = async () => {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM districts
        WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326))
        LIMIT 1
      `;
      return rows[0]?.id ?? null;
    };
    if (!cache) return run();
    return cache.getOrSet(`geo:match:${params.lat}:${params.lng}`, DISTRICT_MATCH_CACHE_TTL_SECONDS, run);
  }

  /** Fallback for a point outside every boundary (e.g. GPS drift at a ward edge) — closest
   * district by centroid distance rather than leaving the caller with nothing at all. */
  async function matchNearestDistrict(params: { lat: number; lng: number }): Promise<string | null> {
    const run = async () => {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM districts
        ORDER BY ST_Centroid(boundary) <-> ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)
        LIMIT 1
      `;
      return rows[0]?.id ?? null;
    };
    if (!cache) return run();
    return cache.getOrSet(`geo:nearest:${params.lat}:${params.lng}`, DISTRICT_MATCH_CACHE_TTL_SECONDS, run);
  }

  return { matchDistrict, matchNearestDistrict };
}

export type GeoMatchService = ReturnType<typeof createGeoMatchService>;
