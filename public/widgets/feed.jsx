// widgets/feed.jsx — RSS + YouTube subscription stream
//
// Config (in layout.yml):
//   - type: feed
//     config:
//       endpoint: /api/feed       # Pages Function
//       limit: 15
//
// Sources are configured in functions/api/feed.js (edit + git push to update;
// Phase 2 candidate: KV-backed editable list).

const FEED_MOCK = [
  { source: 'Hacker News',  title: 'Show HN: A small thing I built',     link: 'https://news.ycombinator.com', published: new Date(Date.now() - 30 * 60_000).toISOString(),  kind: 'rss' },
  { source: 'Fireship',      title: 'TypeScript 6.0 in 100 seconds',      link: 'https://youtube.com',          published: new Date(Date.now() - 2 * 3600_000).toISOString(), kind: 'youtube' },
  { source: 'Lobsters',      title: 'On Worker isolates and cold starts', link: 'https://lobste.rs',            published: new Date(Date.now() - 5 * 3600_000).toISOString(), kind: 'rss' },
  { source: 'YouTube — ThePrimeTime', title: 'I tried Zig for a week',    link: 'https://youtube.com',          published: new Date(Date.now() - 8 * 3600_000).toISOString(), kind: 'youtube' },
];

function FeedWidget({ config }) {
  const size = useWidgetSize();
  const endpoint = config?.endpoint || '/api/feed';
  const columns = !!config?.columns;
  const perSource = config?.perSource ?? (columns ? 5 : 0);
  const limit = config?.limit ?? (size === 'compact' ? 4 : 15);
  const url = columns ? `${endpoint}?perSource=${perSource}` : `${endpoint}?limit=${limit}`;
  const { data, loading, error } = useFetch(url, { ttl: 10 * 60_000, fallback: FEED_MOCK });

  const items = data ?? FEED_MOCK;
  const showingMock = error || !data;
  const action = <span className="muted" style={{fontSize: 11}}>{items.length} items</span>;

  return (
    <Panel title="Feed" hint={mockHint({ error: showingMock ? error : null })} action={action}
           className={columns ? 'panel-wide' : undefined}>
      {columns ? <FeedColumns items={items} loading={loading} /> : <FeedList items={items.slice(0, limit)} loading={loading} />}
    </Panel>
  );
}

function FeedList({ items, loading }) {
  return (
    <div className="feed">
      {items.map((item, i) => <FeedRow key={i} item={item} showSource />)}
      {loading && items.length === 0 && <div className="muted" style={{padding: 12}}>Loading…</div>}
    </div>
  );
}

function FeedColumns({ items, loading }) {
  // Preserve SOURCES declaration order from the API response by grouping
  // on first-appearance, not by alphabetical key.
  const groups = [];
  const idx = new Map();
  for (const it of items) {
    if (!idx.has(it.source)) { idx.set(it.source, groups.length); groups.push({ source: it.source, items: [] }); }
    groups[idx.get(it.source)].items.push(it);
  }
  return (
    <div className="feed feed-cols">
      {groups.map(g => (
        <div key={g.source} className="feed-col">
          <div className="feed-col-head">{g.source}</div>
          {g.items.map((it, i) => <FeedRow key={i} item={it} />)}
        </div>
      ))}
      {loading && groups.length === 0 && <div className="muted" style={{padding: 12}}>Loading…</div>}
    </div>
  );
}

function FeedRow({ item, showSource }) {
  return (
    <a className="feed-item" href={item.link} target="_blank" rel="noopener noreferrer">
      <div className={`feed-kind feed-${item.kind || 'rss'}`}>
        {item.kind === 'youtube' ? '▶' : '◆'}
      </div>
      <div className="feed-body">
        <div className="feed-title">{item.title}</div>
        <div className="feed-meta">
          {showSource && <><span>{item.source}</span><span className="feed-dot">·</span></>}
          <span>{relativeTime(item.published)}</span>
        </div>
      </div>
    </a>
  );
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  if (sec < 604800) return `${Math.round(sec / 86400)}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

registerWidget('feed', FeedWidget);
