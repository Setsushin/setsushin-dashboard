// GET /api/feed?perSource=20 (or ?limit=N for one global time-sorted cap)
// Aggregates RSS + YouTube channel Atom feeds, returns time-sorted JSON.
//
// To add/remove subscriptions: edit SOURCES below + git push (CF Pages auto-deploys).

type Source =
  | { type: 'rss'; name: string; category: string; url: string }
  | { type: 'youtube'; name: string; category: string; channelId: string };

export interface FeedItem {
  source: string;
  category: string;
  kind: string;
  title: string;
  link: string;
  published: string;
}

const SOURCES: Source[] = [
  { type: 'rss', name: 'Bloomberg Markets', category: 'Markets', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { type: 'rss', name: 'Yahoo! ビジネス', category: 'Markets', url: 'https://news.yahoo.co.jp/rss/topics/business.xml' },
  { type: 'rss', name: 'OpenAI News', category: 'AI', url: 'https://openai.com/news/rss.xml' },
  { type: 'rss', name: 'Google AI', category: 'AI', url: 'https://blog.google/technology/ai/rss/' },
  { type: 'rss', name: 'HuggingFace', category: 'AI', url: 'https://huggingface.co/blog/feed.xml' },
  // Anthropic has no official RSS; community scrape of anthropic.com/engineering.
  { type: 'rss', name: 'Anthropic Engineering', category: 'AI', url: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml' },
  { type: 'youtube', name: 'Andrej Karpathy', category: 'AI', channelId: 'UCXUPKJO5MZQN11PqgIvyuvQ' },
  { type: 'rss', name: 'CoinDesk', category: 'Crypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { type: 'rss', name: 'Cointelegraph', category: 'Crypto', url: 'https://cointelegraph.com/rss' },
];

const UA = 'Mozilla/5.0 (compatible; setsushin-dashboard-feed/1.0)';
const CACHE_SECS = 600;

const publishedDesc = (a: FeedItem, b: FeedItem): number =>
  new Date(b.published).getTime() - new Date(a.published).getTime();

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const perSource = Math.min(parseInt(url.searchParams.get('perSource') || '0', 10), 20);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '15', 10), 50);

  const results = await Promise.all(SOURCES.map(fetchSource));

  // perSource > 0: keep top-N per source so every source surfaces — items
  // come back in SOURCES declaration order; frontend can regroup for columns.
  // Else: classic global time-sort capped by limit.
  const items = perSource > 0
    ? results.flatMap((arr) => arr.filter((x) => x.title).sort(publishedDesc).slice(0, perSource))
    : results.flat().filter((x) => x.title).sort(publishedDesc).slice(0, limit);

  return new Response(JSON.stringify(items), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_SECS}, s-maxage=${CACHE_SECS}`,
    },
  });
};

async function fetchSource(src: Source): Promise<FeedItem[]> {
  try {
    const url = src.type === 'youtube'
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${src.channelId}`
      : src.url;
    // 8s per-source timeout so one slow feed doesn't hang the response.
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/xml, application/rss+xml, application/atom+xml' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseFeed(xml, src).map((x) => ({ ...x, category: src.category }));
  } catch {
    return [];
  }
}

// Minimal Atom + RSS 2.0 parser. Atom (YouTube) uses <entry>; RSS uses <item>.
export function parseFeed(xml: string, src: { name: string; type: string }): Omit<FeedItem, 'category'>[] {
  const items: Omit<FeedItem, 'category'>[] = [];

  // Atom <entry>
  for (const m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const block = m[1];
    items.push({
      source: src.name,
      kind: src.type,
      title: cleanText(extract(block, /<title[^>]*>([\s\S]*?)<\/title>/)),
      link: extract(block, /<link[^>]*href="([^"]+)"/) || '',
      published:
        extract(block, /<published>([^<]+)<\/published>/) ||
        extract(block, /<updated>([^<]+)<\/updated>/) ||
        '',
    });
  }
  if (items.length) return items;

  // RSS 2.0 <item>
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    items.push({
      source: src.name,
      kind: src.type,
      title: cleanText(extract(block, /<title[^>]*>([\s\S]*?)<\/title>/)),
      link: cleanText(extract(block, /<link>([\s\S]*?)<\/link>/)) || '',
      published: extract(block, /<pubDate>([^<]+)<\/pubDate>/) || '',
    });
  }
  return items;
}

export function extract(s: string, re: RegExp): string {
  const m = re.exec(s);
  return m ? m[1].trim() : '';
}

export function cleanText(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
