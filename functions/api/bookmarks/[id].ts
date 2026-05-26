// functions/api/bookmarks/[id].ts — patch / delete a single bookmark.
//
// PATCH  /api/bookmarks/<id>  body: { name?, url?, mark?, color?, sort_order? }
// DELETE /api/bookmarks/<id>

import { getUserEmail, json } from '../../_lib/auth';
import { parseJson, toSqlSet } from '../../_lib/parse';
import { bookmarkPatch } from '../../_lib/schemas';
import type { Env } from '../../_lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isInteger(id)) return json({ error: 'bad id' }, { status: 400 });
  const r = await parseJson(request, bookmarkPatch);
  if (r.error) return r.error;
  const { sets, binds } = toSqlSet(r.data, {
    name: 'name',
    url: 'url',
    mark: 'mark',
    color: 'color',
    sort_order: 'sort_order',
  });
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
