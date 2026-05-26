// profile — personal reference items backed by D1 (/api/profile). Grouped by
// free-form category; inline add/edit, optimistic-then-reconcile, drag-reorder.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel } from './Panel';
import { registerWidget } from './registry';
import { PlusIcon } from './icons';
import type { ProfileItem } from '../types';
import './profile.css';

const PROFILE_OTHER = 'Other';

interface ProfileFormValues {
  category: string | null;
  label: string;
  value: string;
  note: string | null;
}

// Keep first-seen order from the (category-sorted) API list; "Other" last.
function groupByCategory(items: ProfileItem[]): Array<{ cat: string; items: ProfileItem[] }> {
  const order: string[] = [];
  const map = new Map<string, ProfileItem[]>();
  for (const it of items) {
    const cat = (it.category || '').trim() || PROFILE_OTHER;
    if (!map.has(cat)) {
      map.set(cat, []);
      order.push(cat);
    }
    map.get(cat)!.push(it);
  }
  order.sort((a, b) => Number(a === PROFILE_OTHER) - Number(b === PROFILE_OTHER));
  return order.map((cat) => ({ cat, items: map.get(cat)! }));
}

function CategorySelect({
  value,
  onChange,
  categories,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = value.trim().toLowerCase();
  const exact = categories.some((c) => c.toLowerCase() === q);
  const opts = !q || exact ? categories : categories.filter((c) => c.toLowerCase().includes(q));

  return (
    <div className="profile-combo" ref={wrapRef}>
      <input
        className="af-input"
        placeholder="Category"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          } else {
            onKeyDown?.(e);
          }
        }}
      />
      {categories.length > 0 && (
        <button
          type="button"
          className="profile-combo-caret"
          tabIndex={-1}
          title="Pick a category"
          onClick={() => setOpen((o) => !o)}
        >
          ▾
        </button>
      )}
      {open && opts.length > 0 && (
        <div className="profile-combo-list">
          {opts.map((c) => (
            <div
              key={c}
              className="profile-combo-opt"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c);
                setOpen(false);
              }}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileForm({
  initial,
  categories,
  onSave,
  onCancel,
}: {
  initial: ProfileItem | null;
  categories: string[];
  onSave: (form: ProfileFormValues) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(initial?.category ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [value, setValue] = useState(initial?.value ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    labelRef.current?.focus();
    labelRef.current?.select();
  }, []);

  const submit = () => {
    if (!label.trim()) return;
    onSave({
      category: category.trim() || null,
      label: label.trim(),
      value: value ?? '',
      note: note.trim() || null,
    });
  };
  const onKeyLine = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  const onKeyArea = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="profile-form">
      <div className="profile-form-grid">
        <CategorySelect value={category ?? ''} onChange={setCategory} categories={categories} onKeyDown={onKeyLine} />
        <input
          ref={labelRef}
          className="af-input"
          placeholder="Label *"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={onKeyLine}
        />
      </div>
      <textarea
        className="af-input profile-form-value"
        placeholder="Value"
        rows={2}
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyArea}
      />
      <input
        className="af-input"
        placeholder="Note (optional)"
        value={note ?? ''}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyLine}
      />
      <div className="profile-form-foot">
        <span className="profile-form-hint">⌘↵ to save · Esc to cancel</span>
        <button className="panel-action" onClick={onCancel}>
          Cancel
        </button>
        <button className="panel-action edit-save" disabled={!label.trim()} onClick={submit}>
          Save
        </button>
      </div>
    </div>
  );
}

function ProfileRow({
  item,
  onEditStart,
  onDelete,
  dragId,
  setDragId,
  onReorder,
}: {
  item: ProfileItem;
  onEditStart: () => void;
  onDelete: () => void;
  dragId: number | null;
  setDragId: (id: number | null) => void;
  onReorder: (targetId: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    if (!item.value) return;
    try {
      await navigator.clipboard.writeText(item.value);
      setCopied(true);
    } catch (err) {
      alert('Copy failed: ' + (err as Error).message);
    }
  };

  return (
    <div
      className={`profile-row ${dragId === item.id ? 'dragging' : ''}`}
      draggable={armed}
      onDragStart={(e) => {
        setDragId(item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        setArmed(false);
        setDragId(null);
      }}
      onDragOver={(e) => {
        if (dragId != null && dragId !== item.id) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onReorder(item.id);
        setArmed(false);
      }}
    >
      <span
        className="profile-drag"
        title="Drag to reorder"
        onMouseDown={() => setArmed(true)}
        onMouseUp={() => setArmed(false)}
      >
        ⠿
      </span>
      <div className="profile-row-label">{item.label}</div>
      <div className="profile-row-value">
        {item.value ? (
          <span className="profile-value-text" title="Click copy to grab it">
            {item.value}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
        {item.note && <span className="profile-row-note muted">{item.note}</span>}
      </div>
      <div className="profile-row-actions">
        {item.value && (
          <button className="profile-row-act" onClick={copy} data-ack={copied ? '1' : '0'} title="Copy value">
            {copied ? '✓' : 'copy'}
          </button>
        )}
        <button className="profile-row-act" onClick={onEditStart} title="Edit">
          ✎
        </button>
        <button className="profile-row-act profile-row-del" onClick={onDelete} title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}

function ProfileWidget() {
  const [items, setItems] = useState<ProfileItem[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);

  const reload = useCallback(() => {
    return fetch('/api/profile')
      .then((r) => (r.ok ? (r.json() as Promise<ProfileItem[]>) : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const list = items || [];
  const categories = [...new Set(list.map((i) => (i.category || '').trim()).filter(Boolean))];

  const mutate = async (
    label: string,
    optimistic: () => void,
    doFetch: () => Promise<Response>,
    { reloadOnSuccess = false }: { reloadOnSuccess?: boolean } = {},
  ) => {
    optimistic();
    try {
      const r = await doFetch();
      if (!r.ok) throw new Error(`${label} failed: HTTP ${r.status}`);
      if (reloadOnSuccess) void reload();
    } catch (err) {
      console.error(err);
      alert(`${(err as Error).message}\nReverting.`);
      void reload();
    }
  };

  const create = (form: ProfileFormValues) =>
    mutate(
      'POST',
      () => {
        setAdding(false);
        setItems((a) => [...(a || []), { ...form, id: -Date.now() }]);
      },
      () =>
        fetch('/api/profile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        }),
      { reloadOnSuccess: true },
    );

  const update = (id: number, patch: ProfileFormValues) =>
    mutate(
      'PATCH',
      () => {
        setEditingId(null);
        setItems((a) => (a || []).map((it) => (it.id === id ? { ...it, ...patch } : it)));
      },
      () =>
        fetch(`/api/profile/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        }),
    );

  const remove = (id: number, label: string) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    return mutate(
      'DELETE',
      () => setItems((a) => (a || []).filter((it) => it.id !== id)),
      () => fetch(`/api/profile/${id}`, { method: 'DELETE' }),
    );
  };

  // Reorder within a category: drop dragId onto targetId, renumber that
  // category's sort_order, optimistic-update, then PATCH the changed rows.
  const onReorder = (targetId: number) => {
    const fromId = dragId;
    if (fromId == null || fromId === targetId) {
      setDragId(null);
      return;
    }
    const catOf = (it: ProfileItem) => (it.category || '').trim() || PROFILE_OTHER;
    const a = list.find((i) => i.id === fromId);
    const b = list.find((i) => i.id === targetId);
    if (!a || !b || catOf(a) !== catOf(b)) {
      setDragId(null);
      return;
    }

    const slots: number[] = [];
    list.forEach((it, i) => {
      if (catOf(it) === catOf(a)) slots.push(i);
    });
    const catItems = slots.map((i) => list[i]);
    const ids = catItems.map((x) => x.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(targetId);
    const reordered = catItems.slice();
    reordered.splice(to, 0, reordered.splice(from, 1)[0]);

    const changed: ProfileItem[] = [];
    const renumbered = reordered.map((it, i) => {
      if (it.sort_order === i) return it;
      const n = { ...it, sort_order: i };
      changed.push(n);
      return n;
    });
    const slotSet = new Set(slots);
    let k = 0;
    setItems(list.map((it, i) => (slotSet.has(i) ? renumbered[k++] : it)));
    setDragId(null);

    if (changed.length) {
      void Promise.allSettled(
        changed.map((it) =>
          fetch(`/api/profile/${it.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sort_order: it.sort_order }),
          }),
        ),
      ).then((rs) => {
        if (rs.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))) void reload();
      });
    }
  };

  const action = !adding && (
    <button
      className="panel-action"
      onClick={() => {
        setEditingId(null);
        setAdding(true);
      }}
    >
      <PlusIcon /> Add
    </button>
  );

  if (items === null) {
    return (
      <Panel title="Profile" action={action} className="panel-wide">
        <div className="muted" style={{ padding: 16 }}>
          Loading…
        </div>
      </Panel>
    );
  }

  const groups = groupByCategory(list);

  return (
    <Panel title="Profile" action={action} className="panel-wide">
      <div className="profile-body">
        {adding && (
          <ProfileForm initial={null} categories={categories} onSave={create} onCancel={() => setAdding(false)} />
        )}

        {groups.map((g) => (
          <div key={g.cat} className="profile-group">
            <div className="profile-group-head">{g.cat}</div>
            <div className="profile-group-body">
              {g.items.map((it) =>
                editingId === it.id ? (
                  <ProfileForm
                    key={it.id}
                    initial={it}
                    categories={categories}
                    onSave={(form) => update(it.id, form)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <ProfileRow
                    key={it.id}
                    item={it}
                    dragId={dragId}
                    setDragId={setDragId}
                    onReorder={onReorder}
                    onEditStart={() => {
                      setAdding(false);
                      setEditingId(it.id);
                    }}
                    onDelete={() => remove(it.id, it.label)}
                  />
                ),
              )}
            </div>
          </div>
        ))}

        {list.length === 0 && !adding && (
          <div className="muted" style={{ padding: 16 }}>
            Nothing here yet — click + Add to stash a number you always forget.
          </div>
        )}
      </div>
    </Panel>
  );
}

ProfileWidget.fixedSize = { rowSpan: 3, full: true };

registerWidget('profile', ProfileWidget);
