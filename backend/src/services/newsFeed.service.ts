import { fetchRssFeed, type RssItem } from "../crawler/rssFetcher.js";

const FEED_URL = "https://bocongan.gov.vn/api/rss/35.xml";
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
}

export interface NewsFeedDeps {
  /** Injectable so tests never hit the real network — mirrors pressCrawler.service.ts. */
  fetchFeed?: (feedUrl: string) => Promise<RssItem[]>;
}

/**
 * Trang "Tin tức" — tin chính thức từ bocongan.gov.vn hiển thị nguyên văn, KHÔNG qua pipeline
 * lọc từ khóa/geo-match/dedup của pressCrawler.service.ts (pipeline đó dành cho tín hiệu nghi
 * vấn cần cán bộ xác minh — CLAUDE.md #1/#2/#3). Đây chỉ là đọc tin, không tạo signal/report
 * nào, nên không cần DB, chỉ cache trong bộ nhớ để đỡ gọi nguồn liên tục.
 */
export function createNewsFeedService(deps: NewsFeedDeps = {}) {
  const fetchFeed = deps.fetchFeed ?? fetchRssFeed;
  let cache: { items: NewsItem[]; fetchedAt: number } | null = null;

  async function list(): Promise<NewsItem[]> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.items;

    try {
      const items = await fetchFeed(FEED_URL);
      const mapped = items.map((item) => ({
        title: item.title,
        link: item.link,
        summary: item.content.slice(0, 300),
        publishedAt: item.pubDate,
      }));
      cache = { items: mapped, fetchedAt: Date.now() };
      return mapped;
    } catch (err) {
      if (cache) return cache.items; // nguồn tạm lỗi — trả bản cache cũ còn hơn lỗi trắng trang
      throw err;
    }
  }

  return { list };
}

export type NewsFeedService = ReturnType<typeof createNewsFeedService>;
