// Typed window CustomEvent bus that decouples task mutations from the widgets
// and StatStrip that observe them, plus the global task-modal triggers.

import type { Task } from '../types';

export interface TasksOptimistic {
  patch?: Array<Partial<Task> & { id: number }>;
  removeIds?: number[];
}

const TASKS_EVENT = 'tasks-updated';
const OPEN_TASK_MODAL = 'open-task-modal';
const FOCUS_TASK_INPUT = 'focus-task-input';

// dispatch with optimistic → mutate local caches synchronously (no network).
// dispatch with no args → reconcile (reload from /api/tasks).
export function dispatchTasksUpdated(optimistic?: TasksOptimistic): void {
  window.dispatchEvent(
    new CustomEvent(TASKS_EVENT, optimistic ? { detail: { optimistic } } : undefined),
  );
}

export function onTasksUpdated(handler: (optimistic?: TasksOptimistic) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<{ optimistic?: TasksOptimistic }>).detail?.optimistic);
  window.addEventListener(TASKS_EVENT, listener);
  return () => window.removeEventListener(TASKS_EVENT, listener);
}

// Optimistic-then-reconcile wrapper. `optimistic` is applied immediately;
// `run` is the network call. Always fires a plain reconcile event in finally.
export async function mutateTasks({
  optimistic,
  run,
}: {
  optimistic?: TasksOptimistic;
  run: () => Promise<unknown>;
}): Promise<void> {
  if (optimistic) dispatchTasksUpdated(optimistic);
  try {
    await run();
  } finally {
    dispatchTasksUpdated();
  }
}

// Open the global TaskFormModal (rendered by App). Pass a task to edit it.
export function openTaskModal(task?: Task): void {
  window.dispatchEvent(new CustomEvent(OPEN_TASK_MODAL, task ? { detail: { task } } : undefined));
}

export function onOpenTaskModal(handler: (task?: Task) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<{ task?: Task }>).detail?.task);
  window.addEventListener(OPEN_TASK_MODAL, listener);
  return () => window.removeEventListener(OPEN_TASK_MODAL, listener);
}

export function focusTaskInput(): void {
  window.dispatchEvent(new CustomEvent(FOCUS_TASK_INPUT));
}

export function onFocusTaskInput(handler: () => void): () => void {
  window.addEventListener(FOCUS_TASK_INPUT, handler);
  return () => window.removeEventListener(FOCUS_TASK_INPUT, handler);
}
