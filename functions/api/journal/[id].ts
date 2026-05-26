// functions/api/journal/[id].ts — patch/delete a single journal entry.
//
// PATCH  /api/journal/123  → body: { body?, title?, tags? }; partial; bumps updated_at.
//                            title: string → set, null → clear, omitted → skip.
// DELETE /api/journal/123  → remove.

import { getUserEmail, json } from '../../_lib/auth';
import { httpError, parseId } from '../../_lib/http';
import { parseJson, toSqlSet } from '../../_lib/parse';
import { journalPatch, serializeTags } from '../../_lib/schemas';
import type { Env } from '../../_lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const p = parseId(params.id);
  if (p.error) return p.error;
  const id = p.id;

  const r = await parseJson(request, journalPatch);
  if (r.error) return r.error;
  const { sets, binds } = toSqlSet(r.data, {
    body: 'body',
    title: 'title',
    tags: { col: 'tags', enc: serializeTags },
  });

  if (sets.length === 0) return httpError(400, 'no updatable fields');
  sets.push('updated_at = ?');
  binds.push(Math.floor(Date.now() / 1000));

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE journal_entries SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`)
    .bind(...binds, id, email)
    .run();
  if (meta.changes === 0) return httpError(404, 'not found');
  return json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ env, params, request }) => {
  const email = getUserEmail(request, env);
  const p = parseId(params.id);
  if (p.error) return p.error;
  const id = p.id;

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare('DELETE FROM journal_entries WHERE id = ? AND user_email = ?')
    .bind(id, email)
    .run();
  if (meta.changes === 0) return httpError(404, 'not found');
  return json({ ok: true, id });
};
