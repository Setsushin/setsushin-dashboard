// functions/api/tasks/[id].ts — patch/delete a single task by id.
//
// PATCH  /api/tasks/123   → body: { text?, description?, tag?, kind?, done?, due_at? }; partial
// DELETE /api/tasks/123   → remove

import { getUserEmail, json } from '../../_lib/auth';
import { parseJson, toSqlSet } from '../../_lib/parse';
import { taskPatch } from '../../_lib/schemas';
import type { Env } from '../../_lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const r = await parseJson(request, taskPatch);
  if (r.error) return r.error;
  const { sets, binds } = toSqlSet(r.data, {
    text: 'text',
    description: 'description',
    tag: 'tag',
    kind: 'kind',
    done: { col: 'done', enc: (v) => (v ? 1 : 0) },
    due_at: 'due_at',
  });
  if (sets.length === 0) return json({ error: 'no updatable fields' }, { status: 400 });

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`)
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
    .prepare('DELETE FROM tasks WHERE id = ? AND user_email = ?')
    .bind(id, email)
    .run();
  if (meta.changes === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true, id });
};
