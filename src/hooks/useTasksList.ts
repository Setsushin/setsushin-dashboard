// useTasksList — D1-backed, refreshed on `tasks-updated` events.
// Returns [tasks, reload]. Pass enabled=false to skip the network call.

import { useCallback, useEffect, useState } from 'react';
import { onTasksUpdated, type TasksOptimistic } from '../lib/events';
import type { Task } from '../types';

export function useTasksList(enabled = true): [Task[] | null, () => void] {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  const reload = useCallback(() => {
    if (!enabled) return;
    fetch('/api/tasks')
      .then((r) => (r.ok ? (r.json() as Promise<Task[]>) : []))
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setTasks(null);
      return;
    }
    reload();
    return onTasksUpdated((opt?: TasksOptimistic) => {
      if (!opt) {
        reload();
        return;
      }
      setTasks((prev) => applyOptimistic(prev, opt));
    });
  }, [enabled, reload]);

  return [tasks, reload];
}

function applyOptimistic(prev: Task[] | null, opt: TasksOptimistic): Task[] | null {
  if (!prev) return prev;
  let next = prev;
  let changed = false;
  if (Array.isArray(opt.patch) && opt.patch.length) {
    const mapped = next.map((t) => {
      const p = opt.patch!.find((x) => x.id === t.id);
      if (!p) return t;
      changed = true;
      return { ...t, ...p };
    });
    if (changed) next = mapped;
  }
  if (Array.isArray(opt.removeIds) && opt.removeIds.length) {
    const drop = new Set(opt.removeIds);
    const filtered = next.filter((t) => !drop.has(t.id));
    if (filtered.length !== next.length) {
      next = filtered;
      changed = true;
    }
  }
  return changed ? next : prev;
}
