import { describe, expect, it, vi } from "vitest";
import { createGeoMatchService } from "./geoMatch.service.js";
import type { Cache } from "../cache/cache.js";

/** In-memory stand-in for the real Redis-backed Cache — enough to prove geoMatch.service.ts
 * wires caching correctly, without needing a live Postgres+PostGIS connection (see
 * docs/adr/0001-postgis-geometry-via-unsupported-raw-sql.md — the real ST_Contains/ST_Centroid
 * SQL itself isn't unit-testable). */
function buildInMemoryCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    async getOrSet<T>(key: string, _ttlSeconds: number, fetch: () => Promise<T>): Promise<T> {
      if (store.has(key)) return store.get(key) as T;
      const value = await fetch();
      store.set(key, value);
      return value;
    },
  };
}

function buildFakePrisma(rows: { id: string }[]) {
  const queryRaw = vi.fn(async () => rows);
  return { $queryRaw: queryRaw } as any;
}

describe("geoMatch.service — caching", () => {
  it("without a cache, hits the DB every call", async () => {
    const prisma = buildFakePrisma([{ id: "d1" }]);
    const geoMatch = createGeoMatchService(prisma);

    await geoMatch.matchDistrict({ lat: 10, lng: 106 });
    await geoMatch.matchDistrict({ lat: 10, lng: 106 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("with a cache, only hits the DB once for the same exact coordinates", async () => {
    const prisma = buildFakePrisma([{ id: "d1" }]);
    const cache = buildInMemoryCache();
    const geoMatch = createGeoMatchService(prisma, cache);

    const first = await geoMatch.matchDistrict({ lat: 10, lng: 106 });
    const second = await geoMatch.matchDistrict({ lat: 10, lng: 106 });

    expect(first).toBe("d1");
    expect(second).toBe("d1");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("a different coordinate is a separate cache key — still hits the DB", async () => {
    const prisma = buildFakePrisma([{ id: "d1" }]);
    const cache = buildInMemoryCache();
    const geoMatch = createGeoMatchService(prisma, cache);

    await geoMatch.matchDistrict({ lat: 10, lng: 106 });
    await geoMatch.matchDistrict({ lat: 11, lng: 107 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("matchDistrict and matchNearestDistrict use independent cache keys for the same point", async () => {
    const prisma = buildFakePrisma([{ id: "d1" }]);
    const cache = buildInMemoryCache();
    const geoMatch = createGeoMatchService(prisma, cache);

    await geoMatch.matchDistrict({ lat: 10, lng: 106 });
    await geoMatch.matchNearestDistrict({ lat: 10, lng: 106 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
