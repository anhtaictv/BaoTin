import Parser from "rss-parser";

export interface RssItem {
  title: string;
  link: string;
  content: string;
  pubDate: string | null;
}

const parser = new Parser();

/** Thin wrapper so pressCrawler.service.ts can take an injectable fetchFeed for tests. */
export async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  const feed = await parser.parseURL(feedUrl);
  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "",
    link: item.link ?? "",
    content: item.contentSnippet ?? item.content ?? item.summary ?? "",
    pubDate: item.isoDate ?? item.pubDate ?? null,
  }));
}
