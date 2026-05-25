// bookmarks — view layer. Two data modes: static (config.items) or D1-backed
// (config.bucket, editable in-UI). layout.yml owns placement + which bucket.

import { useState } from 'react';
import { Panel } from './Panel';
import { registerWidget, useWidgetSize } from './registry';
import { PlusIcon, XIcon } from './icons';
import { AddBookmarkModal, useBookmarks } from './bookmarks-edit';
import type { Bookmark, WidgetProps } from '../types';
import './bookmarks.css';

// Prepend https:// when no scheme is present so href works regardless.
function bookmarkHref(url: string | undefined): string {
  if (!url) return '#';
  return url.startsWith('http') ? url : `https://${url}`;
}

function BookmarksWidget({ config }: WidgetProps) {
  const size = useWidgetSize();
  const bucket = config?.bucket as string | undefined;
  const staticItems = config?.items as Bookmark[] | undefined;
  const [items, { create, remove, editable }] = useBookmarks(bucket, staticItems);
  const [adding, setAdding] = useState(false);
  const isLoading = !!bucket && items === null;
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
  const closeModal = () => setAdding(false);
  const modal = adding && (
    <AddBookmarkModal
      onSave={(form) => {
        create(form);
        setAdding(false);
      }}
      onClose={closeModal}
    />
  );

  // Header-strip mode: a horizontal row of chips, no panel chrome.
  if (config?.layout === 'row') {
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
              <span className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
                {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
              </span>
              <span className="bookmark-row-name">{b.name}</span>
              {editable && (
                <button className="bookmark-row-del" onClick={(e) => onDelete(e, b)} title="Delete bookmark">
                  <XIcon size={10} />
                </button>
              )}
            </a>
          ))}
          {editable && (
            <button className="bookmark-row-add" onClick={onAddClick} title="Add bookmark" aria-label="Add bookmark">
              <PlusIcon />
            </button>
          )}
          {isLoading && <span className="muted" style={{ fontSize: 11, padding: '0 8px' }}>…</span>}
        </div>
        {modal}
      </>
    );
  }

  if (size === 'compact') {
    return (
      <Panel title="Bookmarks" action={<span className="muted" style={{ fontSize: 11 }}>{list.length} saved</span>}>
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
              <div className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
                {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
              </div>
              {editable && (
                <button className="bookmark-row-del" onClick={(e) => onDelete(e, b)} title="Delete bookmark">
                  <XIcon size={10} />
                </button>
              )}
            </a>
          ))}
          {editable && (
            <button
              className="bookmark-row-add bookmark-add-square"
              onClick={onAddClick}
              title="Add bookmark"
              aria-label="Add bookmark"
            >
              <PlusIcon />
            </button>
          )}
          {list.length === 0 && !editable && <div className="muted" style={{ padding: 12 }}>No bookmarks.</div>}
        </div>
        {modal}
      </Panel>
    );
  }

  return (
    <Panel title="Bookmarks">
      <div>
        {list.map((b) => (
          <a
            key={b.id ?? b.name}
            className="bookmark"
            href={bookmarkHref(b.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
              {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
            </div>
            <div className="bookmark-body">
              <div className="bookmark-name">{b.name}</div>
              <div className="bookmark-url">{b.url}</div>
            </div>
            {editable && (
              <button
                className="bookmark-row-del bookmark-large-del"
                onClick={(e) => onDelete(e, b)}
                title="Delete bookmark"
              >
                <XIcon size={10} />
              </button>
            )}
          </a>
        ))}
        {editable && (
          <button className="bookmark-add-row" onClick={onAddClick}>
            <span style={{ display: 'inline-flex', verticalAlign: '-1px', marginRight: 6 }}>
              <PlusIcon size={11} />
            </span>
            Add bookmark
          </button>
        )}
        {list.length === 0 && !editable && (
          <div className="muted" style={{ padding: 12 }}>No bookmarks yet — add to layout.yml.</div>
        )}
      </div>
      {modal}
    </Panel>
  );
}

registerWidget('bookmarks', BookmarksWidget);
