import { describe, expect, it, vi, beforeEach } from "vitest";

const getMock = vi.fn();
const setMock = vi.fn();

// Mock ioredis entirely — these tests must never touch a real Redis instance.
vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(function FakeRedis() {
    return { get: getMock, set: setMock, on: vi.fn() };
  }),
}));

const { createCache } = await import("./cache.js");

describe("cache.getOrSet", () => {
  beforeEach(() => {
    getMock.mockReset();
    setMock.mockReset();
  });

  it("cache miss: calls fetch(), stores the result, and returns it", async () => {
    getMock.mockResolvedValue(null);
    setMock.mockResolvedValue("OK");
    const cache = createCache("redis://localhost:6379");
    const fetch = vi.fn(async () => ({ id: "district-1" }));

    const result = await cache.getOrSet("geo:match:1:1", 300, fetch);

    expect(result).toEqual({ id: "district-1" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith("geo:match:1:1", JSON.stringify({ id: "district-1" }), "EX", 300);
  });

  it("cache hit: returns the cached value without calling fetch()", async () => {
    getMock.mockResolvedValue(JSON.stringify({ id: "district-1" }));
    const cache = createCache("redis://localhost:6379");
    const fetch = vi.fn(async () => ({ id: "should-not-be-returned" }));

    const result = await cache.getOrSet("geo:match:1:1", 300, fetch);

    expect(result).toEqual({ id: "district-1" });
    expect(fetch).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("fails open on a redis.get() error — calls fetch() and returns its value", async () => {
    getMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const cache = createCache("redis://localhost:6379");
    const fetch = vi.fn(async () => "fallback-value");

    await expect(cache.getOrSet("some-key", 300, fetch)).resolves.toBe("fallback-value");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails open on a redis.set() error — still returns the freshly fetched value", async () => {
    getMock.mockResolvedValue(null);
    setMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const cache = createCache("redis://localhost:6379");
    const fetch = vi.fn(async () => "fresh-value");

    await expect(cache.getOrSet("some-key", 300, fetch)).resolves.toBe("fresh-value");
  });
});
