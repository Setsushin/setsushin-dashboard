// feed — RSS + YouTube subscription stream via /api/feed.

import { useState } from 'react';
import { Panel, type PanelSize } from './Panel';
import { mockHint } from './mockHint';
import { useFetch } from '../hooks/useFetch';
import type { FeedItem } from '../types';
import './feed.css';

const FEED_MOCK: FeedItem[] = [
  { source: 'Hacker News', category: 'Tech', title: 'Show HN: A small thing I built', link: 'https://news.ycombinator.com', published: new Date(Date.now() - 30 * 60_000).toISOString(), kind: 'rss' },
  { source: 'Fireship', category: 'Video', title: 'TypeScript 6.0 in 100 seconds', link: 'https://youtube.com', published: new Date(Date.now() - 2 * 3600_000).toISOString(), kind: 'youtube' },
  { source: 'Lobsters', category: 'Tech', title: 'On Worker isolates and cold starts', link: 'https://lobste.rs', published: new Date(Date.now() - 5 * 3600_000).toISOString(), kind: 'rss' },
  { source: 'YouTube — ThePrimeTime', category: 'Video', title: 'I tried Zig for a week', link: 'https://youtube.com', published: new Date(Date.now() - 8 * 3600_000).toISOString(), kind: 'youtube' },
];

const PER_SOURCE = 20;

const time = (iso: string) => Date.parse(iso) || 0;

export function Feed({ size = 'large' }: { size?: PanelSize }) {
  const { data, loading, error } = useFetch<FeedItem[]>(`/api/feed?perSource=${PER_SOURCE}`, { ttl: 10 * 60_000, fallback: FEED_MOCK });
  const [tab, setTab] = useState('');

  const items = data ?? FEED_MOCK;
  const showingMock = error || !data;
  const categories = [...new Set(items.map((x) => x.category))];
  const active = categories.includes(tab) ? tab : categories[0];
  const shown = items
    .filter((x) => x.category === active)
    .sort((a, b) => time(b.published) - time(a.published));

  const action = (
    <div className="seg" role="group" aria-label="Category">
      {categories.map((c) => (
        <button key={c} type="button" className="seg-btn" aria-pressed={c === active} onClick={() => setTab(c)}>
          {c}
        </button>
      ))}
    </div>
  );

  return (
    <Panel size={size} title="Feed" hint={mockHint({ error: showingMock ? error : null })} action={action}>
      <FeedList items={shown} loading={loading} />
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
