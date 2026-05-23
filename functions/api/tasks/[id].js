// functions/api/tasks/[id].js — patch/delete a single task by id.
// CF Pages dynamic-route filename: [id] → params.id at runtime.
//
// PATCH  /api/tasks/123             → body: { text?, tag?, kind?, done? }; partial update
// DELETE /api/tasks/123             → remove

import { getUserEmail, json } from '../../_lib/auth.js';

const FIELDS = {
  text:        { sql: 'text = ?',        prep: v => typeof v === 'string' ? v : null },
  description: { sql: 'description = ?', prep: v => v == null ? null : (typeof v === 'string' && v.trim() ? v.trim() : null) },
  tag:         { sql: 'tag = ?',         prep: v => v ?? null },
  kind:        { sql: 'kind = ?',        prep: v => v ?? null },
  done:        { sql: 'done = ?',        prep: v => typeof v === 'boolean' ? (v ? 1 : 0) : null },
  due_at:      { sql: 'due_at = ?',      prep: v => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  } },
};
// Fields where `null` is a meaningful value (clear the cell) instead of "skip".
const NULLABLE = new Set(['tag', 'kind', 'description', 'due_at']);

export async function onRequestPatch({ request, env, params }) {
  const email = getUserEmail(request, env);
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const sets = [];
  const binds = [];
  for (const [k, v] of Object.entries(body)) {
    const spec = FIELDS[k];
    if (!spec) continue;                // ignore unknown fields silently
    const prepared = spec.prep(v);
    if (prepared == null && !NULLABLE.has(k)) continue;
    sets.push(spec.sql);
    binds.push(prepared);
  }
  if (sets.length === 0) return json({ error: 'no updatable fields' }, { status: 400 });

  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`
  ).bind(...binds, id, email).run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
}

export async function onRequestDelete({ env, params, request }) {
  const email = getUserEmail(request, env);
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `DELETE FROM tasks WHERE id = ? AND user_email = ?`
  ).bind(id, email).run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
}
