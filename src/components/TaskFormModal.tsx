// TaskFormModal — add/edit dialog shared by the tasks widget, the sidebar
// Quick Capture, and the global `N` hotkey. A single instance is rendered by
// App; widgets open it via openTaskModal() (lib/events).

import { useEffect, useRef, useState } from 'react';
import { mutateTasks } from '../lib/events';
import { apiFetch } from '../lib/api';
import { deriveKind, dueAtToLocalInput, localInputToDueAt, TAG_PRESETS } from './tasks-utils';
import type { Task } from '../types';

export interface TaskFormModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
}

export function TaskFormModal({ open, task, onClose }: TaskFormModalProps) {
  const isEdit = !!task;
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('Personal');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const topicRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    if (isEdit && task) {
      setTopic(task.text || '');
      setDescription(task.description || '');
      setTag(task.tag || 'Personal');
      setDue(dueAtToLocalInput(task.due_at));
    } else {
      setTopic('');
      setDescription('');
      setTag('Personal');
      setDue('');
    }
    setBusy(false);
  }, [open, isEdit, task]);

  // Focus topic on open and on switch-to-different-task without close.
  useEffect(() => {
    if (!open) return;
    topicRef.current?.focus();
  }, [open, task?.id]);

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
      if (isEdit && task) {
        await mutateTasks({
          optimistic: { patch: [{ id: task.id, ...payload }] },
          run: () =>
            apiFetch(`/api/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            }),
        });
      } else {
        await mutateTasks({
          run: () =>
            apiFetch('/api/tasks', {
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

  // Stable keydown: stash latest submit in a ref so the listener doesn't
  // re-bind on every keystroke.
  submitRef.current = submit;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = topic.trim().length > 0 && !busy;

  async function handleDelete() {
    if (!isEdit || !task || busy) return;
    setBusy(true);
    try {
      await mutateTasks({
        optimistic: { removeIds: [task.id] },
        run: () => apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' }),
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
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
            {TAG_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="modal-foot">
          {isEdit && (
            <button className="panel-action pm-delete" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <span className="task-modal-hint">⌘↵ to {isEdit ? 'save' : 'add'} · Esc to cancel</span>
          <button className="panel-action" onClick={onClose}>
            Cancel
          </button>
          <button className="panel-action edit-save" disabled={!canSubmit} onClick={submit}>
            {isEdit ? 'Save' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}
