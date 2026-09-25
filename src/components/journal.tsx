// journal — D1-backed free-form journal. Title is a separate column; body
// renders as markdown (marked + DOMPurify, see lib/markdown).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Panel } from './Panel';
import { Heatmap } from './Heatmap';
import { PlusIcon, XIcon } from './icons';
import { renderMarkdown } from '../lib/markdown';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { useJournalImages } from './journal-images';
import type { JournalEntry } from '../types';
import './journal.css';

const IMG_ICON = '🖼';

function fmtEntryDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

const localDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE');

function parseTagsInput(s: string): string[] {
  return (s || '')
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function uniqTags(entries: JournalEntry[]): string[] {
  const s = new Set<string>();
  for (const e of entries) for (const t of e.tags || []) s.add(t);
  return [...s].sort((a, b) => a.localeCompare(b));
}

interface EntryDraft {
  title: string | null;
  body: string;
  tags: string[];
}

function EntryEditor({
  entry,
  onSave,
  onCancel,
  onDelete,
}: {
  entry?: JournalEntry;
  onSave: (draft: EntryDraft) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(entry?.title || '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [tagsInput, setTagsInput] = useState((entry?.tags || []).join(', '));
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const img = useJournalImages(taRef, body, setBody);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
  }, []);

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSave({ title: title.trim() || null, body: text, tags: parseTagsInput(tagsInput) });
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  // On window, not the inputs: Esc must work after focus leaves them.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onCancel]);

  return (
    <div className="journal-editor">
      <div className="journal-entry-meta">{entry ? fmtEntryDate(entry.created_at) : 'New post'}</div>
      <input
        className="field journal-entry-title-edit"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKey}
        placeholder="Topic（可选）"
      />
      <textarea
        ref={taRef}
        className={`field journal-entry-body-edit${img.dragOver ? ' is-dragover' : ''}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKey}
        onPaste={img.onPaste}
        onDrop={img.onDrop}
        onDragOver={img.onDragOver}
        onDragLeave={img.onDragLeave}
        placeholder="写点什么…  支持 markdown：**粗体** · `code` · - list · [link](url) · 粘贴/拖图片"
      />
      <input
        className="field journal-entry-tags-edit"
        type="text"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        onKeyDown={onKey}
        placeholder="tags (逗号分隔)"
      />
      <div className="journal-entry-actions">
        {onDelete && (
          <button className="panel-action btn-danger" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        )}
        <button className="journal-img-btn" onClick={img.openPicker} title="插入图片" type="button">
          {IMG_ICON}
        </button>
        <input
          ref={img.fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={img.onFileChange}
        />
        <span style={{ flex: 1 }} />
        <span className="muted journal-hint">{img.uploading ? '上传中…' : '⌘↵ save · Esc cancel'}</span>
        <button className="panel-action" onClick={onCancel}>
          Cancel
        </button>
        <button className="panel-action btn-primary" onClick={submit} disabled={!body.trim() || busy}>
          Save
        </button>
      </div>
    </div>
  );
}

function EntryTags({ tags, onTagClick }: { tags: string[]; onTagClick: (t: string) => void }) {
  if (!tags?.length) return null;
  return (
    <div className="journal-entry-tags">
      {tags.map((t) => (
        <span
          key={t}
          className="chip journal-tag-chip"
          onClick={(e) => {
            e.stopPropagation();
            onTagClick(t);
          }}
          title={`Filter by "${t}"`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function EntryView({
  entry,
  onOpen,
  onTagClick,
}: {
  entry: JournalEntry;
  onOpen: () => void;
  onTagClick: (t: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 2);
  }, [entry.body, entry.title]);

  const html = useMemo(() => renderMarkdown(entry.body), [entry.body]);

  return (
    <div
      className="journal-entry is-openable"
      tabIndex={0}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a')) onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
      }}
    >
      <div className="journal-entry-meta">{fmtEntryDate(entry.created_at)}</div>
      {entry.title && <div className="journal-entry-title">{entry.title}</div>}
      <div
        ref={bodyRef}
        className={`journal-entry-body markdown is-clamped${overflowing ? ' is-overflowing' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <EntryTags tags={entry.tags} onTagClick={onTagClick} />
    </div>
  );
}

function Reader({
  entry,
  editing,
  onEdit,
  onClose,
  onSave,
  onCancelEdit,
  onDelete,
  onTagClick,
}: {
  entry: JournalEntry;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSave: (draft: EntryDraft) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onTagClick: (t: string) => void;
}) {
  // Esc closes — unless the editor already took it (→ back to reading).
  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  const html = useMemo(() => renderMarkdown(entry.body), [entry.body]);

  return (
    <div className="modal-backdrop" onClick={editing ? undefined : onClose}>
      <article className="modal journal-reader" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <EntryEditor entry={entry} onSave={onSave} onCancel={onCancelEdit} onDelete={onDelete} />
        ) : (
          <>
            <div className="journal-entry-head">
              <div className="journal-entry-meta">{fmtEntryDate(entry.created_at)}</div>
              <button type="button" className="panel-action" onClick={onEdit}>
                Edit
              </button>
              <button type="button" className="panel-action" onClick={onClose} aria-label="Close">
                <XIcon />
              </button>
            </div>
            {entry.title && <h2 className="journal-entry-title">{entry.title}</h2>}
            <div className="journal-entry-body markdown" dangerouslySetInnerHTML={{ __html: html }} />
            <EntryTags tags={entry.tags} onTagClick={onTagClick} />
          </>
        )}
      </article>
    </div>
  );
}

interface FilterBarProps {
  q: string;
  setQ: (v: string) => void;
  allTags: string[];
  activeTags: Set<string>;
  toggleTag: (t: string) => void;
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  onClear: () => void;
  hasFilters: boolean;
  count: number;
}

function FilterBar(props: FilterBarProps) {
  const {
    q, setQ, allTags, activeTags, toggleTag,
    fromDate, setFromDate, toDate, setToDate,
    onClear, hasFilters, count,
  } = props;
  return (
    <div className="journal-filter">
      <div className="journal-filter-row">
        <input
          className="field journal-filter-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / 正文…"
        />
        <input className="field journal-filter-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="muted journal-filter-arrow">→</span>
        <input className="field journal-filter-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <span className="muted journal-filter-count">{count} 条</span>
        {hasFilters && (
          <button className="panel-action" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {allTags.length > 0 && (
        <div className="journal-filter-tags">
          {allTags.map((t) => (
            <span
              key={t}
              className={`chip journal-tag-chip ${activeTags.has(t) ? 'is-active' : ''}`}
              onClick={() => toggleTag(t)}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Journal() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const open = (id: number | null) => {
    setOpenId(id);
    setEditing(false);
  };
  const [q, setQ] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const reload = useCallback(() => {
    return fetch('/api/journal')
      .then((r) => (r.ok ? (r.json() as Promise<JournalEntry[]>) : []))
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async ({ title, body, tags }: EntryDraft): Promise<boolean> => {
    try {
      const r = await apiFetch('/api/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, tags }),
      });
      const created = (await r.json()) as JournalEntry;
      setEntries((prev) => [created, ...(prev || [])]);
      return true;
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
      return false;
    }
  };

  const update = async (id: number, patch: EntryDraft) => {
    const now = Math.floor(Date.now() / 1000);
    setEntries((prev) => (prev || []).map((e) => (e.id === id ? { ...e, ...patch, updated_at: now } : e)));
    setEditing(false);
    try {
      await apiFetch(`/api/journal/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      showToast(`Update failed: ${(err as Error).message} — reloading`, 'error');
      void reload();
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this entry?')) return;
    setEntries((prev) => (prev || []).filter((e) => e.id !== id));
    open(null);
    try {
      await apiFetch(`/api/journal/${id}`, { method: 'DELETE' });
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message} — reloading`, 'error');
      void reload();
    }
  };

  const list = entries || [];

  // Deps key on `entries`, not `list` — `entries || []` is a fresh [] each
  // render when entries is null, which would defeat the memo.
  const allTags = useMemo(() => uniqTags(list), [entries]);

  const filtered = useMemo(() => {
    const fromTs = fromDate ? Math.floor(new Date(fromDate + 'T00:00:00').getTime() / 1000) : null;
    const toTs = toDate ? Math.floor(new Date(toDate + 'T23:59:59').getTime() / 1000) : null;
    const qLower = q.trim().toLowerCase();
    return list.filter((e) => {
      if (fromTs && e.created_at < fromTs) return false;
      if (toTs && e.created_at > toTs) return false;
      if (qLower) {
        const inTitle = (e.title || '').toLowerCase().includes(qLower);
        const inBody = e.body.toLowerCase().includes(qLower);
        if (!inTitle && !inBody) return false;
      }
      if (activeTags.size > 0) {
        const entryTags = e.tags || [];
        for (const t of activeTags) if (!entryTags.includes(t)) return false;
      }
      return true;
    });
  }, [entries, q, fromDate, toDate, activeTags]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list) {
      const d = localDay(e.created_at * 1000);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [entries]);
  const pickedDay = fromDate && fromDate === toDate ? fromDate : undefined;
  const pickDay = (d: string) => {
    const next = d === pickedDay ? '' : d;
    setFromDate(next);
    setToDate(next);
  };

  const opened = list.find((e) => e.id === openId);

  const hasFilters = !!(q || activeTags.size || fromDate || toDate);
  const onClear = () => {
    setQ('');
    setActiveTags(new Set());
    setFromDate('');
    setToDate('');
  };
  const toggleTag = (t: string) =>
    setActiveTags((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });

  return (
    <Panel
      size="full"
      rows={5}
      action={
        <button type="button" className="panel-action" onClick={() => setCreating(true)}>
          <PlusIcon /> New post
        </button>
      }
    >
      <div className="journal-root">
        <details className="fold journal-hist">
          <summary>History</summary>
          <div className="fold-body">
            <Heatmap
              today={localDay(Date.now())}
              active={pickedDay}
              noun="entries"
              onPick={pickDay}
              day={(d) => {
                const n = byDay.get(d);
                return n ? { count: n, title: `${d} · ${n} 条`, attrs: { 'data-n': Math.min(n, 4) } } : null;
              }}
            />
          </div>
        </details>
        <FilterBar
          q={q}
          setQ={setQ}
          allTags={allTags}
          activeTags={activeTags}
          toggleTag={toggleTag}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          onClear={onClear}
          hasFilters={hasFilters}
          count={filtered.length}
        />
        <div className="journal-list">
          {entries === null && <div className="empty">Loading…</div>}
          {entries !== null && filtered.length === 0 && (
            <div className="empty">
              {list.length === 0 ? '还没有条目 — 点 New post 写一条。' : '没有条目匹配当前筛选。'}
            </div>
          )}
          {filtered.map((e) => (
            <EntryView
              key={e.id}
              entry={e}
              onOpen={() => open(e.id)}
              onTagClick={(t) => toggleTag(t)}
            />
          ))}
        </div>
      </div>
      {opened &&
        createPortal(
          <Reader
            entry={opened}
            editing={editing}
            onEdit={() => setEditing(true)}
            onClose={() => open(null)}
            onSave={(patch) => update(opened.id, patch)}
            onCancelEdit={() => setEditing(false)}
            onDelete={() => remove(opened.id)}
            onTagClick={(t) => {
              open(null);
              toggleTag(t);
            }}
          />,
          document.body,
        )}
      {creating &&
        createPortal(
          <div className="modal-backdrop">
            <article className="modal journal-reader">
              <EntryEditor
                onSave={async (d) => {
                  if (await create(d)) setCreating(false);
                }}
                onCancel={() => setCreating(false)}
              />
            </article>
          </div>,
          document.body,
        )}
    </Panel>
  );
}
