import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPressCrawlerService } from "./pressCrawler.service.js";
import type { RssItem } from "./rssFetcher.js";
import type { Summarizer } from "./summarizer.js";

const SOURCE = { name: "Test Source", feedUrl: "https://example.com/rss", pollIntervalMinutes: 30 };

function createFakePrisma(seedSignals: { id: string; sourceUrl: string; summary: string; crawledAt: Date }[] = []) {
  const signals = [...seedSignals];
  const created: any[] = [];
  return {
    store: { signals, created },
    district: {
      async findMany() {
        return [{ id: "d1", tenXa: "Buôn Ma Thuột" }];
      },
    },
    socialMediaSignal: {
      async findFirst({ where }: any) {
        return signals.find((s) => s.sourceUrl === where.sourceUrl) ?? null;
      },
      async findMany({ where }: any) {
        return signals.filter((s) => s.crawledAt >= where.crawledAt.gte);
      },
      async create({ data }: any) {
        const row = { id: randomUUID(), crawledAt: new Date(), ...data };
        created.push(row);
        signals.push({ id: row.id, sourceUrl: row.sourceUrl, summary: row.summary, crawledAt: row.crawledAt });
        return row;
      },
    },
  };
}

const stubSummarizer: Summarizer = { summarize: async ({ title }) => `Tóm tắt: ${title}` };

function item(overrides: Partial<RssItem> = {}): RssItem {
  return {
    title: "Công an bắt giữ nhóm trộm cắp xe máy tại Buôn Ma Thuột",
    link: `https://example.com/bai-${randomUUID()}`,
    content: "Nội dung chi tiết về vụ trộm cắp...",
    pubDate: new Date().toISOString(),
    ...overrides,
  };
}

describe("pressCrawler.service — crawlSource", () => {
  it("inserts a matching item with detected category and district", async () => {
    const fakePrisma = createFakePrisma();
    const service = createPressCrawlerService({
      prisma: fakePrisma as any,
      summarizer: stubSummarizer,
      fetchFeed: async () => [item()],
    });

    const result = await service.crawlSource(SOURCE);

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(fakePrisma.store.created[0]).toMatchObject({
      trustLevel: "verified_press",
      detectedCategory: "trom_cap",
      districtId: "d1",
      sourceName: "Test Source",
    });
  });

  it("skips an item with no matching category keyword", async () => {
    const fakePrisma = createFakePrisma();
    const service = createPressCrawlerService({
      prisma: fakePrisma as any,
      summarizer: stubSummarizer,
      fetchFeed: async () => [item({ title: "Đội tuyển bóng đá thắng trận giao hữu", content: "" })],
    });

    const result = await service.crawlSource(SOURCE);
    expect(result).toEqual({ inserted: 0, skipped: 1 });
  });

  it("skips an item whose sourceUrl already exists", async () => {
    const existingUrl = "https://example.com/already-seen";
    const fakePrisma = createFakePrisma([
      { id: "existing", sourceUrl: existingUrl, summary: "cũ", crawledAt: new Date() },
    ]);
    const service = createPressCrawlerService({
      prisma: fakePrisma as any,
      summarizer: stubSummarizer,
      fetchFeed: async () => [item({ link: existingUrl })],
    });

    const result = await service.crawlSource(SOURCE);
    expect(result).toEqual({ inserted: 0, skipped: 1 });
  });

  it("marks a near-duplicate item with duplicateOfId instead of skipping it", async () => {
    const fakePrisma = createFakePrisma([
      {
        id: "earlier",
        sourceUrl: "https://example.com/earlier",
        summary: "Công an bắt giữ nhóm trộm cắp xe máy tại Buôn Ma Thuột",
        crawledAt: new Date(),
      },
    ]);
    const service = createPressCrawlerService({
      prisma: fakePrisma as any,
      summarizer: stubSummarizer,
      fetchFeed: async () => [
        item({ title: "Công an bắt giữ nhóm trộm cắp xe máy ở Buôn Ma Thuột" }),
      ],
    });

    const result = await service.crawlSource(SOURCE);
    expect(result.inserted).toBe(1);
    expect(fakePrisma.store.created[0].duplicateOfId).toBe("earlier");
  });

  it("skips items with no link", async () => {
    const fakePrisma = createFakePrisma();
    const service = createPressCrawlerService({
      prisma: fakePrisma as any,
      summarizer: stubSummarizer,
      fetchFeed: async () => [item({ link: "" })],
    });

    const result = await service.crawlSource(SOURCE);
    expect(result).toEqual({ inserted: 0, skipped: 1 });
  });
});
