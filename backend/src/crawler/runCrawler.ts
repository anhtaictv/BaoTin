/**
 * Entry point for the RSS press crawler — deliberately a *separate* process/script from
 * `server.ts`, never imported by it. CLAUDE.md non-negotiable #4: no live crawling during
 * demo/thi. Run manually or via cron with `npm run crawl:rss` when you actually want live
 * data; booting the API server alone never triggers a crawl.
 */
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { createSummarizer } from "./summarizer.js";
import { createPressCrawlerService } from "./pressCrawler.service.js";
import { fetchRssFeed } from "./rssFetcher.js";
import { RSS_SOURCES } from "./rssSources.js";

async function runOnce(service: ReturnType<typeof createPressCrawlerService>) {
  for (const source of RSS_SOURCES) {
    try {
      const result = await service.crawlSource(source);
      // eslint-disable-next-line no-console
      console.log(`[press-crawler] ${source.name}: +${result.inserted} tín hiệu mới, bỏ qua ${result.skipped}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[press-crawler] ${source.name} lỗi:`, err);
    }
  }
}

async function main() {
  const env = loadEnv();
  const summarizer = createSummarizer(env);
  const service = createPressCrawlerService({ prisma, summarizer, fetchFeed: fetchRssFeed });

  // eslint-disable-next-line no-console
  console.log(`[press-crawler] khởi động — ${RSS_SOURCES.length} nguồn, LLM_PROVIDER=${env.LLM_PROVIDER}`);
  await runOnce(service);

  // Cấu hình tần suất riêng theo từng nguồn — mỗi nguồn có interval riêng, không phải một
  // lịch chung cho tất cả.
  for (const source of RSS_SOURCES) {
    setInterval(
      () => {
        service.crawlSource(source).then(
          (result) => {
            // eslint-disable-next-line no-console
            console.log(`[press-crawler] ${source.name}: +${result.inserted} tín hiệu mới, bỏ qua ${result.skipped}`);
          },
          (err) => {
            // eslint-disable-next-line no-console
            console.error(`[press-crawler] ${source.name} lỗi:`, err);
          },
        );
      },
      source.pollIntervalMinutes * 60 * 1000,
    );
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[press-crawler] lỗi khởi động:", err);
  process.exit(1);
});
