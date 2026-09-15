// bookmarks — D1-backed per-bucket links, editable in-UI. Two renderings:
// `row` is the chip strip above a page's grid; default is a compact panel.

import { useState } from 'react';
import { Panel } from './Panel';
import { PlusIcon, XIcon } from './icons';
import { AddBookmarkModal, useBookmarks } from './bookmarks-edit';
import type { Bookmark } from '../types';
import './bookmarks.css';

// Prepend https:// when no scheme is present so href works regardless.
function bookmarkHref(url: string | undefined): string {
  if (!url) return '#';
  return url.startsWith('http') ? url : `https://${url}`;
}

export function Bookmarks({ bucket, row = false }: { bucket: string; row?: boolean }) {
  const [items, { create, remove }] = useBookmarks(bucket);
  const [adding, setAdding] = useState(false);
  const isLoading = items === null;
  const list = items ?? [];

  const onAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setAdding(true);
  };
  const onDelete = (e: React.MouseEvent, b: Bookmark) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Delete "${b.name}"?`)) remove(b.id);
  };
  const modal = adding && (
    <AddBookmarkModal
      onSave={(form) => {
        create(form);
        setAdding(false);
      }}
      onClose={() => setAdding(false)}
    />
  );
  const favicon = (b: Bookmark) => (
    <span className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
      {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
    </span>
  );

  if (row) {
    return (
      <>
        <div className="bookmarks-row">
          {list.map((b) => (
            <a
              key={b.id ?? b.name}
              className="bookmark-row-chip"
              href={bookmarkHref(b.url)}
              target="_blank"
              rel="noopener noreferrer"
              title={b.url}
            >
              {favicon(b)}
              <span className="bookmark-row-name">{b.name}</span>
              <button className="bookmark-row-del" onClick={(e) => onDelete(e, b)} title="Delete bookmark">
                <XIcon size={10} />
              </button>
            </a>
          ))}
          <button className="bookmark-row-add" onClick={onAddClick} title="Add bookmark" aria-label="Add bookmark">
            <PlusIcon />
          </button>
          {isLoading && <span className="muted" style={{ fontSize: 11, padding: '0 8px' }}>…</span>}
        </div>
        {modal}
      </>
    );
  }

  return (
    <Panel size="compact" title="Bookmarks" action={<span className="label-mono">{list.length} saved</span>}>
      <div className="bookmark-strip">
        {list.map((b) => (
          <a
            key={b.id ?? b.name}
            className="bookmark-chip"
            href={bookmarkHref(b.url)}
            target="_blank"
            rel="noopener noreferrer"
            title={b.name}
          >
            {favicon(b)}
            <button className="bookmark-row-del" onClick={(e) => onDelete(e, b)} title="Delete bookmark">
              <XIcon size={10} />
            </button>
          </a>
        ))}
        <button
          className="bookmark-row-add bookmark-add-square"
          onClick={onAddClick}
          title="Add bookmark"
          aria-label="Add bookmark"
        >
          <PlusIcon />
        </button>
      </div>
      {modal}
    </Panel>
  );
}
