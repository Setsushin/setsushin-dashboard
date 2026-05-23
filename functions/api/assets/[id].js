// functions/api/assets/[id].js — patch/delete a single asset by id.
//
// PATCH  /api/assets/123            → body: { layer?, sublayer?, name?, jpy_man?, exposure?, account?, sort_order? }
// DELETE /api/assets/123            → remove

import { getUserEmail, json } from '../../_lib/auth.js';

const VALID_EXPOSURE = new Set(['jpy', 'usd', 'mixed-50-50']);

const FIELDS = {
  layer:      { sql: 'layer = ?',      prep: v => typeof v === 'string' && v.trim() ? v.trim() : null },
  sublayer:   { sql: 'sublayer = ?',   prep: v => v == null ? null : String(v) || null,  nullable: true },
  name:       { sql: 'name = ?',       prep: v => typeof v === 'string' && v.trim() ? v.trim() : null },
  jpy_man:    { sql: 'jpy_man = ?',    prep: v => Number.isFinite(+v) ? +v : null },
  exposure:   { sql: 'exposure = ?',   prep: v => typeof v === 'string' && VALID_EXPOSURE.has(v.toLowerCase()) ? v.toLowerCase() : null },
  account:    { sql: 'account = ?',    prep: v => v == null ? null : String(v) || null,  nullable: true },
  sort_order: { sql: 'sort_order = ?', prep: v => Number.isFinite(+v) ? +v : null },
};

export async function onRequestPatch({ request, env, params }) {
  const email = getUserEmail(request, env);
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const sets = [];
  const binds = [];
  for (const [k, v] of Object.entries(body)) {
    const spec = FIELDS[k];
    if (!spec) continue;
    const prepared = spec.prep(v);
    if (prepared == null && !spec.nullable) continue;
    sets.push(spec.sql);
    binds.push(prepared);
  }
  if (sets.length === 0) return json({ error: 'no updatable fields' }, { status: 400 });

  sets.push('updated_at = unixepoch()');

  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `UPDATE assets SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`
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
    `DELETE FROM assets WHERE id = ? AND user_email = ?`
  ).bind(id, email).run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
}
