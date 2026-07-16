import type { PrismaClient } from "@prisma/client";
import { detectCategory, detectDistrict } from "./keywordFilter.js";
import { findDuplicate } from "./dedup.js";
import type { Summarizer } from "./summarizer.js";
import type { RssItem } from "./rssFetcher.js";
import type { RssSourceConfig } from "./rssSources.js";

/** How far back to look when checking for near-duplicate coverage of the same event. */
const DUPLICATE_LOOKBACK_HOURS = 72;

export interface PressCrawlerDeps {
  prisma: PrismaClient;
  summarizer: Summarizer;
  /** Injectable so tests never hit the real network — see rssFetcher.ts for the real impl. */
  fetchFeed: (feedUrl: string) => Promise<RssItem[]>;
}

export interface CrawlSourceResult {
  inserted: number;
  skipped: number;
}

/**
 * Giai đoạn 2 "kênh tình báo mở" — orchestrates one RSS source: fetch → filter theo từ
 * khóa loại vụ việc → nhận diện địa bàn (optional) → gộp tin trùng → tóm tắt → lưu.
 * Không bao giờ ghi vào `reports` — chỉ `social_media_signals` (CLAUDE.md #1/#2).
 */
export function createPressCrawlerService(deps: PressCrawlerDeps) {
  async function crawlSource(source: RssSourceConfig): Promise<CrawlSourceResult> {
    const items = await deps.fetchFeed(source.feedUrl);
    let inserted = 0;
    let skipped = 0;

    const districts = await deps.prisma.district.findMany({ select: { id: true, tenXa: true } });

    for (const item of items) {
      if (!item.link) {
        skipped++;
        continue;
      }

      const existingByUrl = await deps.prisma.socialMediaSignal.findFirst({ where: { sourceUrl: item.link } });
      if (existingByUrl) {
        skipped++;
        continue;
      }

      const combinedText = `${item.title} ${item.content}`;
      const category = detectCategory(combinedText);
      if (!category) {
        skipped++;
        continue;
      }

      const districtId = detectDistrict(combinedText, districts);

      const recentSignals = await deps.prisma.socialMediaSignal.findMany({
        where: { crawledAt: { gte: new Date(Date.now() - DUPLICATE_LOOKBACK_HOURS * 60 * 60 * 1000) } },
        select: { id: true, summary: true, rawSnippet: true },
      });
      const duplicateOfId = findDuplicate(
        item.title,
        recentSignals.map((s) => ({ id: s.id, text: s.summary ?? s.rawSnippet ?? "" })),
      );

      const summary = await deps.summarizer.summarize({ title: item.title, content: item.content });

      await deps.prisma.socialMediaSignal.create({
        data: {
          sourceName: source.name,
          sourceUrl: item.link,
          trustLevel: "verified_press",
          summary,
          rawSnippet: item.content.slice(0, 2000),
          districtId,
          detectedCategory: category,
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
          duplicateOfId,
        },
      });
      inserted++;
    }

    return { inserted, skipped };
  }

  return { crawlSource };
}

export type PressCrawlerService = ReturnType<typeof createPressCrawlerService>;
