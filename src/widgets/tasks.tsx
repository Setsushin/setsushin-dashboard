// tasks — D1-backed tasks via /api/tasks. Add/edit goes through the global
// TaskFormModal (opened via openTaskModal); toggle/remove are optimistic.

import { useEffect } from 'react';
import { Panel } from './Panel';
import { registerWidget, useWidgetSize } from './registry';
import { useTasksList } from '../hooks/useTasksList';
import { dispatchTasksUpdated, mutateTasks, openTaskModal } from '../lib/events';
import { fmtDue } from './tasks-utils';
import type { WidgetProps } from '../types';
import './tasks.css';

const LEGACY_KEY = 'tasks';

// Module-scoped guard — multiple TasksWidget instances share one migration
// attempt to avoid racing the initial GET and double-INSERTing into empty D1.
let migrated = false;

interface LegacyTask {
  text: string;
  tag?: string;
  kind?: string;
  done?: boolean;
}

async function migrateLegacyLocalStorage(legacyKey: string): Promise<number> {
  let local: LegacyTask[];
  try {
    local = JSON.parse(localStorage.getItem(legacyKey) || '[]') as LegacyTask[];
  } catch {
    local = [];
  }
  if (!Array.isArray(local) || local.length === 0) return 0;
  const r = await fetch('/api/tasks');
  if (!r.ok) return 0;
  const existing = (await r.json()) as unknown[];
  if (existing.length > 0) {
    localStorage.removeItem(legacyKey);
    return 0;
  }
  for (const t of local) {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: t.text, tag: t.tag, kind: t.kind, done: !!t.done }),
    }).catch(() => {});
  }
  localStorage.removeItem(legacyKey);
  return local.length;
}

function TasksWidget({ config }: WidgetProps) {
  const [tasks] = useTasksList(true);
  const size = useWidgetSize();

  useEffect(() => {
    if (migrated) return;
    migrated = true;
    const legacyKey = (config?.storageKey as string) || LEGACY_KEY;
    void migrateLegacyLocalStorage(legacyKey).then((n) => {
      if (n > 0) {
        console.log(`tasks: migrated ${n} legacy localStorage tasks to D1`);
        dispatchTasksUpdated();
      }
    });
  }, [config?.storageKey]);

  const toggle = (id: number) => {
    const t = tasks?.find((x) => x.id === id);
    if (!t) return;
    return mutateTasks({
      optimistic: { patch: [{ id, done: !t.done }] },
      run: () =>
        fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ done: !t.done }),
        }),
    });
  };

  const remove = (id: number) =>
    mutateTasks({
      optimistic: { removeIds: [id] },
      run: () => fetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    });

  const clearDone = () => {
    const done = (tasks || []).filter((t) => t.done);
    if (done.length === 0) return;
    return mutateTasks({
      optimistic: { removeIds: done.map((t) => t.id) },
      run: () => Promise.allSettled(done.map((t) => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' }))),
    });
  };

  const list = tasks ?? [];
  const loading = tasks === null;
  const nowSec = Math.floor(Date.now() / 1000);

  if (size === 'compact') {
    const open = list.filter((t) => !t.done);
    const next = open.slice(0, 3);
    return (
      <Panel title="Tasks" action={<span className="muted" style={{ fontSize: 11 }}>{open.length} open</span>}>
        <div className="task-list" style={{ padding: '4px 0' }}>
          {next.map((t) => (
            <div key={t.id} className="task" style={{ padding: '6px 4px' }}>
              <div className="task-check" onClick={() => toggle(t.id)} />
              <div
                className="task-text task-text-clickable"
                style={{ fontSize: 12.5 }}
                title={t.description || 'Click to edit'}
                onClick={() => openTaskModal(t)}
              >
                {t.text}
              </div>
              {t.due_at ? (
                <div
                  className={`task-due ${t.due_at < nowSec ? 'overdue' : ''}`}
                  onClick={() => openTaskModal(t)}
                  title="Click to edit"
                >
                  {fmtDue(t.due_at)}
                </div>
              ) : null}
              <div className={`task-tag ${t.kind || 'personal'}`}>{t.tag || ''}</div>
            </div>
          ))}
          {!loading && open.length === 0 && <div className="muted" style={{ padding: 8 }}>All clear ✓</div>}
          {loading && <div className="muted" style={{ padding: 8 }}>Loading…</div>}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Tasks" action={<button className="panel-action" onClick={clearDone}>Clear done</button>}>
      <div className="task-list">
        {list.map((t) => (
          <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
            <div className={`task-check ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)} />
            <div
              className="task-text task-text-clickable"
              title={t.description || 'Click to edit'}
              onClick={() => openTaskModal(t)}
            >
              {t.text}
            </div>
            {t.due_at ? (
              <div
                className={`task-due ${t.due_at < nowSec && !t.done ? 'overdue' : ''}`}
                onClick={() => openTaskModal(t)}
                title="Click to edit"
              >
                {fmtDue(t.due_at)}
              </div>
            ) : null}
            <div className={`task-tag ${t.kind || 'personal'}`}>{t.tag || ''}</div>
            <button
              type="button"
              className="task-remove"
              aria-label="Delete task"
              title="Delete"
              onClick={() => remove(t.id)}
            >
              ×
            </button>
          </div>
        ))}
        {loading && <div className="muted" style={{ padding: 12 }}>Loading…</div>}
        {!loading && list.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>No tasks yet — click + to add one.</div>
        )}
      </div>
      <button type="button" className="task-add-btn" onClick={() => openTaskModal()}>
        <span className="plus">+</span>Add task
      </button>
    </Panel>
  );
}

registerWidget('tasks', TasksWidget);
