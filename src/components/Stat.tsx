// Stat / StatStrip — top-of-page numeric tiles. Hooks always run (Rules of
// Hooks); gated by enabled/null-url so unrelated stats no-op.

import { useFetch } from '../hooks/useFetch';
import { useTasksList } from '../hooks/useTasksList';
import type { FeedItem, StatConfig } from '../types';

function Stat({ config: s }: { config: StatConfig }) {
  const [tasks] = useTasksList(s.type === 'tasksRemaining');

  const feedUrl = s.type === 'feedCount' ? s.endpoint || '/api/feed' : null;
  const { data: feedData } = useFetch<FeedItem[]>(feedUrl, { ttl: 10 * 60_000, fallback: [] });

  let value: string | number = s.value ?? '—';
  let sub = s.sub ?? '';
  let bar = s.bar;

  if (s.type === 'tasksRemaining' && tasks) {
    const done = tasks.filter((t) => t.done).length;
    value = String(tasks.length - done);
    sub = `${done} done`;
    bar = tasks.length ? done / tasks.length : 0;
  } else if (s.type === 'feedCount' && Array.isArray(feedData)) {
    value = String(feedData.length);
  } else if (s.type === 'count' && Array.isArray(s.items)) {
    value = String(s.items.length);
  }

  return (
    <div className="stat">
      <div className="stat-head">
        <div className={`stat-icon ${s.accent ? 'accent' : ''}`}>
          <img src={s.icon} alt="" />
        </div>
        <span>{s.label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {bar != null ? (
        <div>
          <div className="stat-sub" style={{ marginBottom: 6 }}>
            {sub}
          </div>
          <div className="stat-bar">
            <div className={`stat-bar-fill ${s.accent ? 'accent' : ''}`} style={{ width: `${Math.min(1, bar) * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="stat-sub">{sub}</div>
      )}
    </div>
  );
}

export function StatStrip({ stats }: { stats?: StatConfig[] }) {
  if (!stats || stats.length === 0) return null;
  return (
    <div className="stats">
      {stats.map((s, i) => (
        <Stat key={s.id ?? i} config={s} />
      ))}
    </div>
  );
}
