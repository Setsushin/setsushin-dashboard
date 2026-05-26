// functions/api/tasks.ts — list + create tasks for the current user.
// PATCH/DELETE for individual tasks live in tasks/[id].ts.
//
// GET  /api/tasks  → [{id, text, description, tag, kind, done, due_at, created_at}, …]
// POST /api/tasks  → body: {text, description?, tag?, kind?, done?, due_at?}

import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import { rowToTask, taskInsert, type TaskRow } from '../_lib/schemas';
import type { Env } from '../_lib/types';

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
  return json(results.map(rowToTask), { headers: { 'cache-control': 'no-store' } });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const r = await parseJson(request, taskInsert);
  if (r.error) return r.error;
  const { text, description, tag, kind, done, due_at } = r.data;
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO tasks (user_email, text, description, tag, kind, done, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, text, description ?? null, tag ?? null, kind ?? null, done ? 1 : 0, due_at ?? null)
    .run();
  return json({
    id: meta.last_row_id,
    text,
    description: description ?? null,
    tag: tag ?? null,
    kind: kind ?? null,
    done,
    due_at: due_at ?? null,
  });
};
