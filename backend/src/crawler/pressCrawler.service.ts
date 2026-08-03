import { Prisma, type PrismaClient } from "@prisma/client";
import { detectCategory, detectDistrict } from "./keywordFilter.js";
import { findDuplicateSemantic, NoopSemanticDuplicateChecker, type SemanticDuplicateChecker } from "./dedup.js";
import type { Summarizer } from "./summarizer.js";
import { AlwaysRelevantClassifier, type RelevanceClassifier } from "./relevanceClassifier.js";
import type { RssItem } from "./rssFetcher.js";
import type { RssSourceConfig } from "./rssSources.js";

/** How far back to look when checking for near-duplicate coverage of the same event. */
const DUPLICATE_LOOKBACK_HOURS = 72;

export interface PressCrawlerDeps {
  prisma: PrismaClient;
  summarizer: Summarizer;
  /** Injectable so tests never hit the real network — see rssFetcher.ts for the real impl. */
  fetchFeed: (feedUrl: string) => Promise<RssItem[]>;
  /** Optional AI second-pass after the keyword match — narrows further, never widens. Defaults
   * to AlwaysRelevantClassifier (keyword-only behavior) when not given. */
  relevanceClassifier?: RelevanceClassifier;
  /** Optional AI-assisted dedup for borderline trigram scores. Defaults to
   * NoopSemanticDuplicateChecker (trigram-only behavior) when not given. */
  semanticDuplicateChecker?: SemanticDuplicateChecker;
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
  const relevanceClassifier = deps.relevanceClassifier ?? new AlwaysRelevantClassifier();
  const semanticDuplicateChecker = deps.semanticDuplicateChecker ?? new NoopSemanticDuplicateChecker();

  async function crawlSource(source: RssSourceConfig): Promise<CrawlSourceResult> {
    const items = await deps.fetchFeed(source.feedUrl);
    let inserted = 0;
    let skipped = 0;

    const districts = await deps.prisma.district.findMany({ select: { id: true, tenXa: true, parentName: true } });

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

      const isRelevant = await relevanceClassifier.isRelevant({ title: item.title, content: item.content, category });
      if (!isRelevant) {
        skipped++;
        continue;
      }

      const districtId = detectDistrict(combinedText, districts);

      const recentSignals = await deps.prisma.socialMediaSignal.findMany({
        where: { crawledAt: { gte: new Date(Date.now() - DUPLICATE_LOOKBACK_HOURS * 60 * 60 * 1000) } },
        select: { id: true, summary: true, rawSnippet: true },
      });
      const duplicateOfId = await findDuplicateSemantic(
        item.title,
        recentSignals.map((s) => ({ id: s.id, text: s.summary ?? s.rawSnippet ?? "" })),
        semanticDuplicateChecker,
      );

      const summary = await deps.summarizer.summarize({ title: item.title, content: item.content });

      try {
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
      } catch (err) {
        // The findFirst check above is a fast pre-filter, not a lock — two overlapping crawl
        // runs (cron overlap, retry, multi-worker) can both pass it for the same URL. The
        // "source_url" unique index is the real guard; P2002 here just means another run won
        // the race, so treat it as a duplicate rather than aborting the whole feed.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++;
          continue;
        }
        throw err;
      }
    }

    return { inserted, skipped };
  }

  return { crawlSource };
}

export type PressCrawlerService = ReturnType<typeof createPressCrawlerService>;
