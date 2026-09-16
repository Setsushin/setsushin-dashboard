// tasks — D1-backed tasks via /api/tasks. Add/edit goes through the global
// TaskFormModal (opened via openTaskModal); toggle/remove are optimistic.

import { Panel } from './Panel';
import { useTasksList } from '../hooks/useTasksList';
import { mutateTasks, openTaskModal } from '../lib/events';
import { apiFetch } from '../lib/api';
import { fmtDue } from './tasks-utils';
import './tasks.css';

export function Tasks() {
  const [tasks] = useTasksList(true);

  const toggle = (id: number) => {
    const t = tasks?.find((x) => x.id === id);
    if (!t) return;
    return mutateTasks({
      optimistic: { patch: [{ id, done: !t.done }] },
      run: () =>
        apiFetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ done: !t.done }),
        }),
    });
  };

  const remove = (id: number) =>
    mutateTasks({
      optimistic: { removeIds: [id] },
      run: () => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    });

  const clearDone = () => {
    const done = (tasks || []).filter((t) => t.done);
    if (done.length === 0) return;
    return mutateTasks({
      optimistic: { removeIds: done.map((t) => t.id) },
      run: async () => {
        const rs = await Promise.allSettled(
          done.map((t) => apiFetch(`/api/tasks/${t.id}`, { method: 'DELETE' })),
        );
        if (rs.some((r) => r.status === 'rejected')) throw new Error('Some tasks could not be cleared');
      },
    });
  };

  const list = tasks ?? [];
  const loading = tasks === null;
  const nowSec = Math.floor(Date.now() / 1000);

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
            <div className={`chip task-tag ${t.kind || 'personal'}`}>{t.tag || ''}</div>
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
        {loading && <div className="empty">Loading…</div>}
        {!loading && list.length === 0 && (
          <div className="empty">No tasks yet — click + to add one.</div>
        )}
      </div>
      <button type="button" className="task-add-btn" onClick={() => openTaskModal()}>
        <span className="plus">+</span>Add task
      </button>
    </Panel>
  );
}
