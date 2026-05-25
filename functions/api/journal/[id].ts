// functions/api/journal/[id].ts — patch/delete a single journal entry.
//
// PATCH  /api/journal/123  → body: { body?, title?, tags? }; partial; bumps updated_at.
//                            title: string → set, null → clear, omitted → skip.
// DELETE /api/journal/123  → remove.

import { getUserEmail, json } from '../../_lib/auth';
import { serializeTags } from '../../_lib/journal-tags';
import type { Env } from '../../_lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const patch = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const binds: unknown[] = [];

  if (typeof patch.body === 'string') {
    const trimmed = patch.body.trim();
    if (!trimmed) return json({ error: 'body must not be empty' }, { status: 400 });
    sets.push('body = ?');
    binds.push(trimmed);
  }
  // title: explicit null clears; string sets (empty string also clears).
  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    if (patch.title === null) {
      sets.push('title = ?');
      binds.push(null);
    } else if (typeof patch.title === 'string') {
      sets.push('title = ?');
      binds.push(patch.title.trim() || null);
    }
  }
  const tagSql = serializeTags(patch.tags);
  if (tagSql !== undefined) {
    sets.push('tags = ?');
    binds.push(tagSql);
  }

  if (sets.length === 0) return json({ error: 'no updatable fields' }, { status: 400 });
  sets.push('updated_at = ?');
  binds.push(Math.floor(Date.now() / 1000));

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE journal_entries SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`)
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
    .prepare('DELETE FROM journal_entries WHERE id = ? AND user_email = ?')
    .bind(id, email)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};
