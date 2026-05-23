// functions/api/tasks.js — list + create tasks for the current user.
// PATCH/DELETE for individual tasks live in tasks/[id].js.
//
// GET  /api/tasks                  → [{id, text, tag, kind, done, created_at}, …]
// POST /api/tasks                  → body: {text, tag?, kind?, done?}; returns created row

import { getUserEmail, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  // done last, then chronological — open tasks stay at the top so a
  // pile of completed rows can't bury fresh items above the fold.
  const { results } = await db.prepare(
    `SELECT id, text, description, tag, kind, done, due_at, created_at
       FROM tasks
      WHERE user_email = ?
   ORDER BY done ASC, id ASC`
  ).bind(email).all();
  return json(results.map(r => ({ ...r, done: r.done === 1 })), {
    headers: { 'cache-control': 'no-store' },
  });
}

// Coerce due_at into a positive integer (unix seconds) or null.
function coerceDueAt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function onRequestPost({ request, env }) {
  const email = getUserEmail(request, env);
  const body = await request.json().catch(() => null);
  const text = (body?.text || '').trim();
  if (!text) {
    return json({ error: 'body must be { text: string, description?, tag?, kind?, done?, due_at? }' }, { status: 400 });
  }
  const description = typeof body.description === 'string' && body.description.trim()
    ? body.description.trim() : null;
  const dueAt = coerceDueAt(body.due_at);
  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `INSERT INTO tasks (user_email, text, description, tag, kind, done, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(email, text, description, body.tag || null, body.kind || null,
         body.done ? 1 : 0, dueAt).run();
  return json({
    id: meta.last_row_id,
    text,
    description,
    tag: body.tag || null,
    kind: body.kind || null,
    done: !!body.done,
    due_at: dueAt,
  });
}
