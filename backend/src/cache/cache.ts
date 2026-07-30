import { Redis } from "ioredis";

export interface Cache {
  /** Returns the cached value for `key` if present; otherwise calls `fetch()`, caches the
   * result for `ttlSeconds`, and returns it. Any Redis failure (unreachable, timeout, whatever)
   * fails open — falls back to calling `fetch()` directly rather than rejecting the caller's
   * request, same "optional infra never blocks the request" spirit as the LLM provider
   * fallbacks in services/heatNarrative.ts / crawler/summarizer.ts. */
  getOrSet<T>(key: string, ttlSeconds: number, fetch: () => Promise<T>): Promise<T>;
}

/**
 * Thin ioredis wrapper for caching rarely-changing lookups (e.g. geo-matching's per-point
 * district query, see geo/geoMatch.service.ts). Not meant for anything that needs
 * invalidation-on-write — there's none here by design (see call sites for why that's safe).
 */
export function createCache(redisUrl: string): Cache {
  const redis = new Redis(redisUrl, {
    // Local dev without `docker compose up` (no Redis running) must never hang a request or
    // spam reconnect attempts — one quick failure per call, then fall back to fetch().
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  });
  // ioredis emits an unhandled 'error' event on every failed connection attempt, which crashes
  // the process if nothing listens for it — failures are already handled per-call below.
  redis.on("error", () => {});

  async function getOrSet<T>(key: string, ttlSeconds: number, fetch: () => Promise<T>): Promise<T> {
    try {
      const cached = await redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      return fetch();
    }

    const value = await fetch();
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Cache write failed — the caller already has a correct value, no need to fail the request.
    }
    return value;
  }

  return { getOrSet };
}
