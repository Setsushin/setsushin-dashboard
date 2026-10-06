// digest — daily feed digests (日报) listed like the Feed; a row opens that
// day's report from /api/digests/<date> in a new tab. Reuses feed.css rows.

import { useEffect, useState } from 'react';
import { Panel, type PanelSize } from './Panel';
import { mockHint } from './mockHint';
import { useFetch } from '../hooks/useFetch';
import type { DigestEntry } from '../types';
import './feed.css';

export function Digest({ size = 'large' }: { size?: PanelSize }) {
  const { data, loading, error } = useFetch<DigestEntry[]>('/api/digests', { ttl: 10 * 60_000, fallback: [] });
  const mode = useBodyMode();
  const items = data ?? [];

  return (
    <Panel size={size} title="Digest" hint={mockHint({ error })}>
      <div className="feed">
        {items.map((d) => (
          <a key={d.date} className="feed-item" href={`/api/digests/${d.date}?mode=${mode}`} target="_blank" rel="noopener noreferrer">
            <div className="feed-kind feed-rss">日</div>
            <div className="feed-body">
              <div className="feed-title">{d.headline}</div>
              <div className="feed-meta"><span>{d.date}</span></div>
            </div>
          </a>
        ))}
        {items.length === 0 && <div className="empty">{loading ? 'Loading…' : '还没有日报'}</div>}
      </div>
    </Panel>
  );
}

// App writes the light/dark toggle to <body data-mode>; the report opens on
// another page that can't see it, so follow it here and pass it in the URL.
function useBodyMode(): string {
  const read = () => document.body.dataset.mode ?? 'light';
  const [mode, setMode] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setMode(read()));
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
    return () => mo.disconnect();
  }, []);
  return mode;
}
