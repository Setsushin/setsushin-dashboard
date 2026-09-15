// Bookmarks data + the "+ Add bookmark" modal: useBookmarks fetches one
// bucket from /api/bookmarks and applies create/remove optimistically.

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import type { Bookmark } from '../types';

// Apple system-color inspired palette. The first is the default for new ones.
export const BOOKMARK_SWATCHES = [
  '#7da27c', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#30b0c7',
  '#007aff', '#5856d6', '#af52de', '#ff2d55', '#a2845e',
];

export interface NewBookmark {
  name: string;
  url: string;
  mark: string;
  color: string;
}

export interface BookmarksApi {
  create: (form: NewBookmark) => Promise<void> | void;
  remove: (id: number) => Promise<void> | void;
}

export function useBookmarks(bucket: string): [Bookmark[] | null, BookmarksApi] {
  const [items, setItems] = useState<Bookmark[] | null>(null);

  const reload = useCallback(() => {
    fetch(`/api/bookmarks?bucket=${encodeURIComponent(bucket)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Bookmark[]>) : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [bucket]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = async (form: NewBookmark) => {
    const sort_order = items?.length ?? 0;
    setItems((prev) => [...(prev || []), { ...form, id: -Date.now(), sort_order }]);
    try {
      await apiFetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bucket, ...form, sort_order }),
      });
      reload();
    } catch (err) {
      console.error(err);
      showToast(`Add failed: ${(err as Error).message}`, 'error');
      reload();
    }
  };

  const remove = async (id: number) => {
    setItems((prev) => (prev || []).filter((it) => it.id !== id));
    try {
      await apiFetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
      showToast(`Delete failed: ${(err as Error).message}`, 'error');
      reload();
    }
  };

  return [items, { create, remove }];
}

export function AddBookmarkModal({
  onSave,
  onClose,
}: {
  onSave: (form: NewBookmark) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [mark, setMark] = useState('');
  const [color, setColor] = useState(BOOKMARK_SWATCHES[0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  const canSave = trimmedName.length > 0 && trimmedUrl.length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({
      name: trimmedName,
      url: trimmedUrl,
      mark: (mark.trim() || trimmedName[0]).toUpperCase().slice(0, 2),
      color,
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add bookmark</div>
        <div className="modal-form" onKeyDown={onKey}>
          <label className="pm-row">
            <span className="pm-label">Name</span>
            <input
              className="af-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hacker News"
            />
          </label>
          <label className="pm-row">
            <span className="pm-label">URL</span>
            <input
              className="af-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com (https:// auto-prepended)"
            />
          </label>
          <label className="pm-row">
            <span className="pm-label">Mark</span>
            <input
              className="af-input"
              value={mark}
              maxLength={2}
              onChange={(e) => setMark(e.target.value)}
              placeholder="1–2 chars (defaults to first letter)"
            />
          </label>
          <div className="pm-row">
            <span className="pm-label">Color</span>
            <div className="bookmark-swatches">
              {BOOKMARK_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`bookmark-swatch ${color === c ? 'is-selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span style={{ flex: 1 }} />
          <button className="panel-action" onClick={onClose}>
            Cancel
          </button>
          <button className="panel-action edit-save" disabled={!canSave} onClick={submit}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
