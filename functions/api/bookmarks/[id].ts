// functions/api/bookmarks/[id].ts — patch / delete a single bookmark.
//
// PATCH  /api/bookmarks/<id>  body: { name?, url?, mark?, color?, sort_order? }
// DELETE /api/bookmarks/<id>

import { getUserEmail, json } from '../../_lib/auth';
import { asFiniteNumber } from '../../_lib/coerce';
import { buildPatch, type FieldSpec } from '../../_lib/patch';
import type { Env } from '../../_lib/types';

const FIELDS: Record<string, FieldSpec> = {
  name: { sql: 'name = ?', prep: (v) => String(v).trim() },
  url: { sql: 'url = ?', prep: (v) => String(v).trim() },
  mark: { sql: 'mark = ?', prep: (v) => (v == null ? null : String(v).trim() || null), nullable: true },
  color: { sql: 'color = ?', prep: (v) => (v == null ? null : String(v).trim() || null), nullable: true },
  sort_order: { sql: 'sort_order = ?', prep: (v) => asFiniteNumber(v, 0) },
};

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isInteger(id)) return json({ error: 'bad id' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return json({ error: 'body must be JSON' }, { status: 400 });
  }
  const { sets, binds } = buildPatch(body, FIELDS);
  if (sets.length === 0) return json({ error: 'no recognized fields' }, { status: 400 });
  sets.push('updated_at = unixepoch()');
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE bookmarks_local SET ${sets.join(', ')} WHERE user_email = ? AND id = ?`)
    .bind(...binds, email, id)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isInteger(id)) return json({ error: 'bad id' }, { status: 400 });
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare('DELETE FROM bookmarks_local WHERE user_email = ? AND id = ?')
    .bind(email, id)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};
