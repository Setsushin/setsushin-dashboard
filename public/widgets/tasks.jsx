// widgets/tasks.jsx — D1-backed tasks via /api/tasks. Add/edit goes
// through TaskFormModal; toggle/remove are optimistic (see core.jsx).

const LEGACY_KEY = 'tasks';
const TAG_PRESETS = ['Personal', 'Work'];
const TASKS_EVENT = 'tasks-updated';

// Module-scoped guard (per-script in babel-standalone) — multiple
// TasksWidget instances share one migration attempt to avoid racing
// the initial GET and double-INSERTing into an empty D1.
let migrated = false;

function deriveKind(tag) {
  return (tag || '').trim().toLowerCase() === 'work' ? 'work' : 'personal';
}

// "Apr 6" when time is exactly 00:00, "Apr 6 18:30" otherwise.
function fmtDue(unixSec) {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hh = d.getHours();
  const mm = d.getMinutes();
  if (hh === 0 && mm === 0) return `${month} ${day}`;
  return `${month} ${day} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

function dueAtToLocalInput(unixSec) {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToDueAt(s) {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function dispatchTasksUpdate(detail) {
  window.dispatchEvent(new CustomEvent(TASKS_EVENT, detail ? { detail } : undefined));
}

// Optimistic-then-reconcile wrapper. `optimistic` is the same shape
// useTasksList consumes ({ patch?, removeIds? }); `run` is the network
// call. Always fires a plain reconcile event in `finally`.
async function mutateTasks({ optimistic, run }) {
  if (optimistic) dispatchTasksUpdate({ optimistic });
  try { await run(); } finally { dispatchTasksUpdate(); }
}

async function migrateLegacyLocalStorage(legacyKey) {
  let local;
  try { local = JSON.parse(localStorage.getItem(legacyKey) || '[]'); } catch { local = []; }
  if (!Array.isArray(local) || local.length === 0) return 0;
  // Don't double-migrate: only seed D1 if it's currently empty for this user.
  const r = await fetch('/api/tasks');
  if (!r.ok) return 0;
  const existing = await r.json();
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

// Add and edit share one dialog. `task` provided → edit (PATCH + optimistic
// patch); absent → add (POST). Reuses the global modal kit (.modal-backdrop /
// .modal / .pm-row / .af-input / .modal-foot / .panel-action / .edit-save).
function TaskFormModal({ open, task, onClose }) {
  const isEdit = !!task;
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('Personal');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const topicRef = React.useRef(null);
  const submitRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setTopic(task.text || '');
      setDescription(task.description || '');
      setTag(task.tag || 'Personal');
      setDue(dueAtToLocalInput(task.due_at));
    } else {
      setTopic(''); setDescription(''); setTag('Personal'); setDue('');
    }
    setBusy(false);
  }, [open, isEdit, task]);

  // Focus topic on open and on switch-to-different-task without close.
  React.useEffect(() => {
    if (!open) return;
    topicRef.current?.focus();
  }, [open, task?.id]);

  // Stable keydown: stash latest submit in a ref so the listener doesn't
  // re-bind on every keystroke (deps were [open, topic, desc, tag, due]).
  submitRef.current = submit;
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault(); submitRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = topic.trim().length > 0 && !busy;

  async function submit() {
    const text = topic.trim();
    if (!text || busy) return;
    setBusy(true);
    const payload = {
      text,
      description: description.trim() || null,
      tag: tag.trim() || null,
      kind: deriveKind(tag),
      due_at: localInputToDueAt(due),
    };
    try {
      if (isEdit) {
        await mutateTasks({
          optimistic: { patch: [{ id: task.id, ...payload }] },
          run: () => fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        });
      } else {
        await mutateTasks({
          run: () => fetch('/api/tasks', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        });
      }
    } finally {
      onClose();
    }
  }

  async function handleDelete() {
    if (!isEdit || busy) return;
    setBusy(true);
    try {
      await mutateTasks({
        optimistic: { removeIds: [task.id] },
        run: () => fetch(`/api/tasks/${task.id}`, { method: 'DELETE' }),
      });
    } finally {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-task" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? 'Edit task' : 'New task'}</div>
        <div className="task-form">
          <label className="pm-row">
            <span className="pm-label">Topic *</span>
            <input
              ref={topicRef}
              className="af-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder="What needs doing?"
            />
          </label>
          <label className="pm-row">
            <span className="pm-label">Description</span>
            <textarea
              className="af-input task-form-area"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional context, links…"
            />
          </label>
          <label className="pm-row">
            <span className="pm-label">Tag</span>
            <input
              className="af-input"
              type="text"
              list="task-tag-presets"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Personal"
            />
          </label>
          <label className="pm-row">
            <span className="pm-label">Until</span>
            <input
              className="af-input"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <datalist id="task-tag-presets">
            {TAG_PRESETS.map(p => <option key={p} value={p} />)}
          </datalist>
        </div>
        <div className="modal-foot">
          {isEdit && (
            <button className="panel-action pm-delete" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
          <span style={{flex: 1}} />
          <span className="task-modal-hint">⌘↵ to {isEdit ? 'save' : 'add'} · Esc to cancel</span>
          <button className="panel-action" onClick={onClose}>Cancel</button>
          <button className="panel-action edit-save" disabled={!canSubmit} onClick={submit}>
            {isEdit ? 'Save' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Open the global TaskFormModal (rendered by App).  Pass a task to edit it,
// omit for "add new".  Replaces local setModal(...) — see app.jsx for the
// listener side.
function openTaskModal(task) {
  window.dispatchEvent(new CustomEvent('open-task-modal',
    task ? { detail: { task } } : undefined));
}

function TasksWidget({ config }) {
  const [tasks] = useTasksList(true);

  React.useEffect(() => {
    if (migrated) return;
    migrated = true;
    const legacyKey = config?.storageKey || LEGACY_KEY;
    migrateLegacyLocalStorage(legacyKey).then(n => {
      if (n > 0) {
        console.log(`tasks: migrated ${n} legacy localStorage tasks to D1`);
        dispatchTasksUpdate();
      }
    });
  }, [config?.storageKey]);

  const size = useWidgetSize();

  const toggle = (id) => {
    const t = tasks?.find(x => x.id === id);
    if (!t) return;
    return mutateTasks({
      optimistic: { patch: [{ id, done: !t.done }] },
      run: () => fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ done: !t.done }),
      }),
    });
  };

  const remove = (id) => mutateTasks({
    optimistic: { removeIds: [id] },
    run: () => fetch(`/api/tasks/${id}`, { method: 'DELETE' }),
  });

  const clearDone = () => {
    const done = (tasks || []).filter(t => t.done);
    if (done.length === 0) return;
    return mutateTasks({
      optimistic: { removeIds: done.map(t => t.id) },
      run: () => Promise.allSettled(
        done.map(t => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' }))
      ),
    });
  };

  const list = tasks ?? [];
  const loading = tasks === null;
  const nowSec = Math.floor(Date.now() / 1000);

  if (size === 'compact') {
    const open = list.filter(t => !t.done);
    const next = open.slice(0, 3);
    return (
      <Panel title="Tasks" action={<span className="muted" style={{fontSize: 11}}>{open.length} open</span>}>
        <div className="task-list" style={{padding: '4px 0'}}>
          {next.map((t) => (
            <div key={t.id} className="task" style={{padding: '6px 4px'}}>
              <div className="task-check" onClick={() => toggle(t.id)}></div>
              <div
                className="task-text task-text-clickable"
                style={{fontSize: 12.5}}
                title={t.description || 'Click to edit'}
                onClick={() => openTaskModal(t)}
              >{t.text}</div>
              {t.due_at ? (
                <div
                  className={`task-due ${t.due_at < nowSec ? 'overdue' : ''}`}
                  onClick={() => openTaskModal(t)}
                  title="Click to edit"
                >{fmtDue(t.due_at)}</div>
              ) : null}
              <div className={`task-tag ${t.kind || 'personal'}`}>{t.tag || ''}</div>
            </div>
          ))}
          {!loading && open.length === 0 && <div className="muted" style={{padding: 8}}>All clear ✓</div>}
          {loading && <div className="muted" style={{padding: 8}}>Loading…</div>}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Tasks" action={<button className="panel-action" onClick={clearDone}>Clear done</button>}>
      <div className="task-list">
        {list.map((t) => (
          <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
            <div className={`task-check ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)}></div>
            <div
              className="task-text task-text-clickable"
              title={t.description || 'Click to edit'}
              onClick={() => openTaskModal(t)}
            >{t.text}</div>
            {t.due_at ? (
              <div
                className={`task-due ${t.due_at < nowSec && !t.done ? 'overdue' : ''}`}
                onClick={() => openTaskModal(t)}
                title="Click to edit"
              >{fmtDue(t.due_at)}</div>
            ) : null}
            <div className={`task-tag ${t.kind || 'personal'}`}>{t.tag || ''}</div>
            <button
              type="button"
              className="task-remove"
              aria-label="Delete task"
              title="Delete"
              onClick={() => remove(t.id)}
            >×</button>
          </div>
        ))}
        {loading && <div className="muted" style={{padding: 12}}>Loading…</div>}
        {!loading && list.length === 0 && <div className="muted" style={{padding: 12}}>No tasks yet — click + to add one.</div>}
      </div>
      <button
        type="button"
        className="task-add-btn"
        onClick={() => openTaskModal()}
      >
        <span className="plus">+</span>Add task
      </button>
    </Panel>
  );
}

registerWidget('tasks', TasksWidget);
