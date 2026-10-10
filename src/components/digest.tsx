// digest — daily feed digests (日报) listed like the Feed; a row opens that
// day's report from /api/digests/<date> in a modal iframe (⌘/Ctrl-click still
// opens a new tab). Reuses feed.css rows.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Panel, type PanelSize } from './Panel';
import { mockHint } from './mockHint';
import { XIcon } from './icons';
import { useFetch } from '../hooks/useFetch';
import type { DigestEntry } from '../types';
import './feed.css';
import './digest.css';

export function Digest({ size = 'large' }: { size?: PanelSize }) {
  const { data, loading, error } = useFetch<DigestEntry[]>('/api/digests', { ttl: 10 * 60_000, fallback: [] });
  const mode = useBodyMode();
  const [opened, setOpened] = useState<DigestEntry | null>(null);
  const items = data ?? [];
  const src = (d: DigestEntry) => `/api/digests/${d.date}?mode=${mode}`;

  return (
    <Panel size={size} title="Digest" hint={mockHint({ error })}>
      <div className="feed">
        {items.map((d) => (
          <a
            key={d.date}
            className="feed-item"
            href={src(d)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              setOpened(d);
            }}
          >
            <div className="feed-kind feed-rss">日</div>
            <div className="feed-body">
              <div className="feed-title">{d.headline}</div>
              <div className="feed-meta"><span>{d.date}</span></div>
            </div>
          </a>
        ))}
        {items.length === 0 && <div className="empty">{loading ? 'Loading…' : '还没有日报'}</div>}
      </div>
      {opened && <Reader entry={opened} src={src(opened)} onClose={() => setOpened(null)} />}
    </Panel>
  );
}

function Reader({ entry, src, onClose }: { entry: DigestEntry; src: string; onClose: () => void }) {
  // Esc only reaches this window while focus is outside the iframe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal digest-reader" onClick={(e) => e.stopPropagation()}>
        <div className="digest-reader-head">
          <span className="label-mono">{entry.date}</span>
          <button type="button" className="panel-action" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <iframe
          className="digest-frame"
          src={src}
          title={entry.headline}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        />
      </article>
    </div>,
    document.body,
  );
}

// App writes the light/dark toggle to <body data-mode>; the report is a
// separate document that can't see it, so follow it here and pass it in the URL.
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
