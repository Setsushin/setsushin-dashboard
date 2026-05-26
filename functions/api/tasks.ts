// functions/api/tasks.ts — list + create tasks for the current user.
// PATCH/DELETE for individual tasks live in tasks/[id].ts.
//
// GET  /api/tasks  → [{id, text, description, tag, kind, done, due_at, created_at}, …]
// POST /api/tasks  → body: {text, description?, tag?, kind?, done?, due_at?}

import { getUserEmail, json } from '../_lib/auth';
import { asString } from '../_lib/coerce';
import type { Env } from '../_lib/types';

interface TaskRow {
  id: number;
  text: string;
  description: string | null;
  tag: string | null;
  kind: string | null;
  done: number;
  due_at: number | null;
  created_at: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  // done last, then chronological — open tasks stay at the top.
  const { results } = await db
    .prepare(
      `SELECT id, text, description, tag, kind, done, due_at, created_at
         FROM tasks
        WHERE user_email = ?
     ORDER BY done ASC, id ASC`,
    )
    .bind(email)
    .all<TaskRow>();
  return json(
    results.map((r) => ({ ...r, done: r.done === 1 })),
    { headers: { 'cache-control': 'no-store' } },
  );
};

// Coerce due_at into a positive integer (unix seconds) or null.
function coerceDueAt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = asString(body?.text).trim();
  if (!text) {
    return json(
      { error: 'body must be { text: string, description?, tag?, kind?, done?, due_at? }' },
      { status: 400 },
    );
  }
  const description = asString(body?.description).trim() || null;
  const dueAt = coerceDueAt(body?.due_at);
  const tag = body?.tag != null ? String(body.tag) : null;
  const kind = body?.kind != null ? String(body.kind) : null;
  const done = body?.done ? 1 : 0;
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO tasks (user_email, text, description, tag, kind, done, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, text, description, tag, kind, done, dueAt)
    .run();
  return json({
    id: meta.last_row_id,
    text,
    description,
    tag,
    kind,
    done: !!done,
    due_at: dueAt,
  });
};
