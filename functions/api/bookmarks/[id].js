// functions/api/bookmarks/[id].js — patch / delete a single bookmark.
//
// PATCH  /api/bookmarks/<id>   body: { name?, url?, mark?, color?, sort_order? }
// DELETE /api/bookmarks/<id>
//
// PATCH is partial: only fields present in the body are updated; null clears.

import { getUserEmail, json } from '../../_lib/auth.js';

const FIELDS = {
  name:       { sql: 'name = ?',       prep: (v) => String(v).trim() },
  url:        { sql: 'url = ?',        prep: (v) => String(v).trim() },
  mark:       { sql: 'mark = ?',       prep: (v) => v == null ? null : (String(v).trim() || null) },
  color:      { sql: 'color = ?',      prep: (v) => v == null ? null : (String(v).trim() || null) },
  sort_order: { sql: 'sort_order = ?', prep: (v) => Number.isFinite(+v) ? +v : 0 },
};

export async function onRequestPatch({ request, env, params }) {
  const email = getUserEmail(request, env);
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id)) return json({ error: 'bad id' }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ error: 'body must be JSON' }, { status: 400 });
  }
  const updates = [];
  const binds = [];
  for (const [key, spec] of Object.entries(FIELDS)) {
    if (key in body) { updates.push(spec.sql); binds.push(spec.prep(body[key])); }
  }
  if (updates.length === 0) return json({ error: 'no recognized fields' }, { status: 400 });
  updates.push('updated_at = unixepoch()');
  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `UPDATE bookmarks_local SET ${updates.join(', ')}
      WHERE user_email = ? AND id = ?`
  ).bind(...binds, email, id).run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
}

export async function onRequestDelete({ request, env, params }) {
  const email = getUserEmail(request, env);
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id)) return json({ error: 'bad id' }, { status: 400 });
  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    'DELETE FROM bookmarks_local WHERE user_email = ? AND id = ?'
  ).bind(email, id).run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
}
