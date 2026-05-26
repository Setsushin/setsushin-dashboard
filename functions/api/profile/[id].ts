// functions/api/profile/[id].ts — patch/delete a single profile item by id.
//
// PATCH  /api/profile/123  → body: { category?, label?, value?, note?, sort_order? }; partial
// DELETE /api/profile/123  → remove

import { getUserEmail, json } from '../../_lib/auth';
import { buildPatch, finiteOrNull, trimmedOrNull, type FieldSpec } from '../../_lib/patch';
import type { Env } from '../../_lib/types';

const FIELDS: Record<string, FieldSpec> = {
  category: {
    sql: 'category = ?',
    prep: (v) => (v == null ? null : trimmedOrNull(v)),
    nullable: true,
  },
  label: { sql: 'label = ?', prep: trimmedOrNull },
  value: { sql: 'value = ?', prep: (v) => (typeof v === 'string' ? v : null) },
  note: {
    sql: 'note = ?',
    prep: (v) => (v == null ? null : trimmedOrNull(v)),
    nullable: true,
  },
  sort_order: { sql: 'sort_order = ?', prep: finiteOrNull },
};

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { sets, binds } = buildPatch(body, FIELDS);
  if (sets.length === 0) return json({ error: 'no updatable fields' }, { status: 400 });
  sets.push('updated_at = unixepoch()');

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE profile_items SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`)
    .bind(...binds, id, email)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ env, params, request }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare('DELETE FROM profile_items WHERE id = ? AND user_email = ?')
    .bind(id, email)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};
