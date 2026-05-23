// functions/api/profile/[id].js — patch/delete a single profile item by id.
// CF Pages dynamic-route filename: [id] → params.id at runtime.
//
// PATCH  /api/profile/123           → body: { category?, label?, value?, note?, sort_order? }; partial
// DELETE /api/profile/123           → remove

import { getUserEmail, json } from '../../_lib/auth.js';

const FIELDS = {
  category:   { sql: 'category = ?',   prep: v => v == null ? null : ((typeof v === 'string' && v.trim()) ? v.trim() : null) },
  label:      { sql: 'label = ?',      prep: v => (typeof v === 'string' && v.trim()) ? v.trim() : null },
  value:      { sql: 'value = ?',      prep: v => typeof v === 'string' ? v : null },
  note:       { sql: 'note = ?',       prep: v => v == null ? null : ((typeof v === 'string' && v.trim()) ? v.trim() : null) },
  sort_order: { sql: 'sort_order = ?', prep: v => Number.isFinite(+v) ? +v : null },
};
// Fields where `null` is a meaningful value (clear the cell) instead of "skip".
const NULLABLE = new Set(['category', 'note']);

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
  sets.push('updated_at = ?');
  binds.push(Math.floor(Date.now() / 1000));

  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `UPDATE profile_items SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`
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
    `DELETE FROM profile_items WHERE id = ? AND user_email = ?`
  ).bind(id, email).run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
}
