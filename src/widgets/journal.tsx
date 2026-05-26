// journal — D1-backed free-form journal. Title is a separate column; body
// renders as markdown (marked + DOMPurify, see lib/markdown).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Panel } from './Panel';
import { registerWidget } from './registry';
import { renderMarkdown } from '../lib/markdown';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import type { JournalEntry } from '../types';
import './journal.css';

function fmtEntryDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

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

function Composer({ onCreate }: { onCreate: (draft: EntryDraft) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onCreate({ title: title.trim() || null, body: text, tags: parseTagsInput(tagsInput) });
      setTitle('');
      setBody('');
      setTagsInput('');
      taRef.current?.focus();
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

  return (
    <div className="journal-composer">
      <input
        className="af-input journal-composer-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKey}
        placeholder="Topic（可选）"
      />
      <textarea
        ref={taRef}
        className="journal-composer-body af-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKey}
        placeholder="写点什么…  支持 markdown：**粗体** · `code` · - list · [link](url)"
        rows={3}
      />
      <div className="journal-composer-foot">
        <input
          className="af-input journal-composer-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="tags (逗号分隔)"
        />
        <span className="muted journal-hint">⌘↵ to save</span>
        <button className="panel-action edit-save" onClick={submit} disabled={!body.trim() || busy}>
          Save
        </button>
      </div>
    </div>
  );
}

function EntryEditor({
  entry,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: JournalEntry;
  onSave: (draft: EntryDraft) => Promise<void> | void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(entry.title || '');
  const [body, setBody] = useState(entry.body);
  const [tagsInput, setTagsInput] = useState((entry.tags || []).join(', '));
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const rows = Math.max(4, body.split('\n').length + 1);

  return (
    <div className="journal-entry journal-entry-editing">
      <div className="journal-entry-rail">
        <div className="journal-entry-meta">{fmtEntryDate(entry.created_at)}</div>
      </div>
      <div className="journal-entry-main">
        <input
          className="af-input journal-entry-title-edit"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onKey}
          placeholder="Topic（可选）"
        />
        <textarea
          ref={taRef}
          className="af-input journal-entry-body-edit"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKey}
          rows={rows}
        />
        <input
          className="af-input journal-entry-tags-edit"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="tags"
        />
        <div className="journal-entry-actions">
          <button className="panel-action pm-delete" onClick={onDelete} disabled={busy}>
            Delete
          </button>
          <span style={{ flex: 1 }} />
          <span className="muted journal-hint">⌘↵ save · Esc cancel</span>
          <button className="panel-action" onClick={onCancel}>
            Cancel
          </button>
          <button className="panel-action edit-save" onClick={submit} disabled={!body.trim() || busy}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryView({
  entry,
  expanded,
  onToggleExpand,
  onEdit,
  onTagClick,
}: {
  entry: JournalEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onTagClick: (t: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (expanded) return;
    const el = bodyRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 2);
  }, [entry.body, entry.title, expanded]);

  const showToggle = expanded || overflowing;

  const handleBodyClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest?.('a')) return;
    onEdit();
  };

  const html = useMemo(() => renderMarkdown(entry.body), [entry.body]);

  return (
    <div className="journal-entry">
      <div className="journal-entry-rail">
        <div className="journal-entry-meta" onClick={onEdit}>
          {fmtEntryDate(entry.created_at)}
        </div>
        {entry.tags?.length > 0 && (
          <div className="journal-entry-tags">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="journal-tag-chip"
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
        )}
      </div>
      <div className="journal-entry-main">
        {entry.title && (
          <div className="journal-entry-title" onClick={onEdit}>
            {entry.title}
          </div>
        )}
        <div
          ref={bodyRef}
          className={[
            'journal-entry-body',
            'markdown',
            expanded ? '' : 'is-clamped',
            !expanded && overflowing ? 'is-overflowing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleBodyClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {showToggle && (
          <button
            type="button"
            className="journal-entry-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {expanded ? '收起 ↑' : '展开 ↓'}
          </button>
        )}
      </div>
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
  onCopy: () => void;
  hasFilters: boolean;
  count: number;
  copyAck: boolean;
}

function FilterBar(props: FilterBarProps) {
  const {
    q, setQ, allTags, activeTags, toggleTag,
    fromDate, setFromDate, toDate, setToDate,
    onClear, onCopy, hasFilters, count, copyAck,
  } = props;
  return (
    <div className="journal-filter">
      <div className="journal-filter-row">
        <input
          className="af-input journal-filter-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / 正文…"
        />
        <input className="af-input journal-filter-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="muted journal-filter-arrow">→</span>
        <input className="af-input journal-filter-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <span className="muted journal-filter-count">{count} 条</span>
        {hasFilters && (
          <button className="panel-action" onClick={onClear}>
            Clear
          </button>
        )}
        <button className="panel-action" onClick={onCopy} disabled={count === 0}>
          {copyAck ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {allTags.length > 0 && (
        <div className="journal-filter-tags">
          {allTags.map((t) => (
            <span
              key={t}
              className={`journal-tag-chip ${activeTags.has(t) ? 'is-active' : ''}`}
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

function JournalWidget() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedSet, setExpandedSet] = useState<Set<number>>(() => new Set());
  const [q, setQ] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copyAck, setCopyAck] = useState(false);

  const toggleExpanded = (id: number) =>
    setExpandedSet((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const reload = useCallback(() => {
    return fetch('/api/journal')
      .then((r) => (r.ok ? (r.json() as Promise<JournalEntry[]>) : []))
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async ({ title, body, tags }: EntryDraft) => {
    try {
      const r = await apiFetch('/api/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, tags }),
      });
      const created = (await r.json()) as JournalEntry;
      setEntries((prev) => [created, ...(prev || [])]);
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
    }
  };

  const update = async (id: number, patch: EntryDraft) => {
    const now = Math.floor(Date.now() / 1000);
    setEntries((prev) => (prev || []).map((e) => (e.id === id ? { ...e, ...patch, updated_at: now } : e)));
    setEditingId(null);
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
    setEditingId(null);
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

  const onCopy = async () => {
    if (filtered.length === 0) return;
    const md = filtered
      .map((e) => {
        const heading = `## ${fmtEntryDate(e.created_at)}${e.title ? ` — ${e.title}` : ''}`;
        const tagLine = e.tags && e.tags.length ? `\n*tags: ${e.tags.join(', ')}*` : '';
        return `${heading}${tagLine}\n\n${e.body}`;
      })
      .join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(md);
      setCopyAck(true);
    } catch (err) {
      showToast('Copy failed: ' + (err as Error).message, 'error');
    }
  };

  useEffect(() => {
    if (!copyAck) return;
    const t = setTimeout(() => setCopyAck(false), 1400);
    return () => clearTimeout(t);
  }, [copyAck]);

  return (
    <Panel title="Journal" className="panel-wide">
      <div className="journal-root">
        <Composer onCreate={create} />
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
          onCopy={onCopy}
          hasFilters={hasFilters}
          count={filtered.length}
          copyAck={copyAck}
        />
        <div className="journal-list">
          {entries === null && <div className="muted journal-empty">Loading…</div>}
          {entries !== null && filtered.length === 0 && (
            <div className="muted journal-empty">
              {list.length === 0 ? '还没有条目 — 在上面写一条试试。' : '没有条目匹配当前筛选。'}
            </div>
          )}
          {filtered.map((e) =>
            editingId === e.id ? (
              <EntryEditor
                key={e.id}
                entry={e}
                onSave={(patch) => update(e.id, patch)}
                onCancel={() => setEditingId(null)}
                onDelete={() => remove(e.id)}
              />
            ) : (
              <EntryView
                key={e.id}
                entry={e}
                expanded={expandedSet.has(e.id)}
                onToggleExpand={() => toggleExpanded(e.id)}
                onEdit={() => setEditingId(e.id)}
                onTagClick={(t) => toggleTag(t)}
              />
            ),
          )}
        </div>
      </div>
    </Panel>
  );
}

JournalWidget.fixedSize = { rowSpan: 5, full: true };

registerWidget('journal', JournalWidget);
