import { describe, expect, it, vi } from "vitest";
import { createNewsFeedService } from "./newsFeed.service.js";
import type { RssItem } from "../crawler/rssFetcher.js";

function item(overrides: Partial<RssItem> = {}): RssItem {
  return {
    title: "Tiêu đề mẫu",
    link: "https://bocongan.gov.vn/bai-viet/mau",
    content: "Nội dung mẫu",
    pubDate: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("newsFeed.service", () => {
  it("maps fetched RSS items to news items", async () => {
    const fetchFeed = vi.fn(async () => [item()]);
    const service = createNewsFeedService({ fetchFeed });

    const result = await service.list();

    expect(result).toEqual([
      {
        title: "Tiêu đề mẫu",
        link: "https://bocongan.gov.vn/bai-viet/mau",
        summary: "Nội dung mẫu",
        publishedAt: "2026-07-24T00:00:00.000Z",
      },
    ]);
  });

  it("serves the cache instead of refetching on the next call", async () => {
    const fetchFeed = vi.fn(async () => [item()]);
    const service = createNewsFeedService({ fetchFeed });

    await service.list();
    await service.list();

    expect(fetchFeed).toHaveBeenCalledTimes(1);
  });

  it("falls back to the last good cache when a refetch fails", async () => {
    const fetchFeed = vi
      .fn()
      .mockResolvedValueOnce([item({ title: "Bản đầu" })])
      .mockRejectedValueOnce(new Error("network down"));
    const service = createNewsFeedService({ fetchFeed });

    const first = await service.list();
    // Force past the cache TTL so the second call actually refetches.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    const second = await service.list();

    expect(second).toEqual(first);
    vi.restoreAllMocks();
  });

  it("throws when the first fetch fails and there is no cache to fall back on", async () => {
    const fetchFeed = vi.fn(async () => {
      throw new Error("network down");
    });
    const service = createNewsFeedService({ fetchFeed });

    await expect(service.list()).rejects.toThrow("network down");
  });
});
