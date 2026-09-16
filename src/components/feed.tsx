// feed — RSS + YouTube subscription stream via /api/feed.

import { Panel, type PanelSize } from './Panel';
import { mockHint } from './mockHint';
import { useFetch } from '../hooks/useFetch';
import type { FeedItem } from '../types';
import './feed.css';

const FEED_MOCK: FeedItem[] = [
  { source: 'Hacker News', title: 'Show HN: A small thing I built', link: 'https://news.ycombinator.com', published: new Date(Date.now() - 30 * 60_000).toISOString(), kind: 'rss' },
  { source: 'Fireship', title: 'TypeScript 6.0 in 100 seconds', link: 'https://youtube.com', published: new Date(Date.now() - 2 * 3600_000).toISOString(), kind: 'youtube' },
  { source: 'Lobsters', title: 'On Worker isolates and cold starts', link: 'https://lobste.rs', published: new Date(Date.now() - 5 * 3600_000).toISOString(), kind: 'rss' },
  { source: 'YouTube — ThePrimeTime', title: 'I tried Zig for a week', link: 'https://youtube.com', published: new Date(Date.now() - 8 * 3600_000).toISOString(), kind: 'youtube' },
];

const LIMIT = 15;

export function Feed({ size = 'large' }: { size?: PanelSize }) {
  const { data, loading, error } = useFetch<FeedItem[]>(`/api/feed?limit=${LIMIT}`, { ttl: 10 * 60_000, fallback: FEED_MOCK });

  const items = data ?? FEED_MOCK;
  const showingMock = error || !data;
  const action = <span className="label-mono">{items.length} items</span>;

  return (
    <Panel size={size} title="Feed" hint={mockHint({ error: showingMock ? error : null })} action={action}>
      <FeedList items={items.slice(0, LIMIT)} loading={loading} />
    </Panel>
  );
}

function FeedList({ items, loading }: { items: FeedItem[]; loading: boolean }) {
  return (
    <div className="feed">
      {items.map((item, i) => (
        <FeedRow key={i} item={item} />
      ))}
      {loading && items.length === 0 && <div className="empty">Loading…</div>}
    </div>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  return (
    <a className="feed-item" href={item.link} target="_blank" rel="noopener noreferrer">
      <div className={`feed-kind feed-${item.kind || 'rss'}`}>{item.kind === 'youtube' ? '▶' : '◆'}</div>
      <div className="feed-body">
        <div className="feed-title">{item.title}</div>
        <div className="feed-meta">
          <span>{item.source}</span>
          <span className="feed-dot">·</span>
          <span>{relativeTime(item.published)}</span>
        </div>
      </div>
    </a>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  if (sec < 604800) return `${Math.round(sec / 86400)}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
