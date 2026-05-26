// functions/api/bookmarks/[id].ts — patch / delete a single bookmark.
//
// PATCH  /api/bookmarks/<id>  body: { name?, url?, mark?, color?, sort_order? }
// DELETE /api/bookmarks/<id>

import { getUserEmail, json } from '../../_lib/auth';
import { httpError, parseId } from '../../_lib/http';
import { parseJson, toSqlSet } from '../../_lib/parse';
import { bookmarkPatch } from '../../_lib/schemas';
import type { Env } from '../../_lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const p = parseId(params.id);
  if (p.error) return p.error;
  const id = p.id;
  const r = await parseJson(request, bookmarkPatch);
  if (r.error) return r.error;
  const { sets, binds } = toSqlSet(r.data, {
    name: 'name',
    url: 'url',
    mark: 'mark',
    color: 'color',
    sort_order: 'sort_order',
  });
  if (sets.length === 0) return httpError(400, 'no updatable fields');
  sets.push('updated_at = unixepoch()');
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE bookmarks_local SET ${sets.join(', ')} WHERE user_email = ? AND id = ?`)
    .bind(...binds, email, id)
    .run();
  if (meta.changes === 0) return httpError(404, 'not found');
  return json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const p = parseId(params.id);
  if (p.error) return p.error;
  const id = p.id;
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare('DELETE FROM bookmarks_local WHERE user_email = ? AND id = ?')
    .bind(email, id)
    .run();
  if (meta.changes === 0) return httpError(404, 'not found');
  return json({ ok: true, id });
};
