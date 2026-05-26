// functions/api/assets/[id].ts — patch/delete a single asset by id.
//
// PATCH  /api/assets/123  → body: { layer?, sublayer?, name?, jpy_man?, exposure?, account?, sort_order? }
// DELETE /api/assets/123  → remove

import { getUserEmail, json } from '../../_lib/auth';
import { buildPatch, finiteOrNull, trimmedOrNull, type FieldSpec } from '../../_lib/patch';
import { VALID_EXPOSURE } from '../assets';
import type { Env } from '../../_lib/types';

const FIELDS: Record<string, FieldSpec> = {
  layer: { sql: 'layer = ?', prep: trimmedOrNull },
  sublayer: { sql: 'sublayer = ?', prep: (v) => (v == null ? null : String(v) || null), nullable: true },
  name: { sql: 'name = ?', prep: trimmedOrNull },
  jpy_man: { sql: 'jpy_man = ?', prep: finiteOrNull },
  exposure: {
    sql: 'exposure = ?',
    prep: (v) => (typeof v === 'string' && VALID_EXPOSURE.has(v.toLowerCase()) ? v.toLowerCase() : null),
  },
  account: { sql: 'account = ?', prep: (v) => (v == null ? null : String(v) || null), nullable: true },
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
    .prepare(`UPDATE assets SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`)
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
    .prepare('DELETE FROM assets WHERE id = ? AND user_email = ?')
    .bind(id, email)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};
