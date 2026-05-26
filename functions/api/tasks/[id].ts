// functions/api/tasks/[id].ts — patch/delete a single task by id.
//
// PATCH  /api/tasks/123   → body: { text?, description?, tag?, kind?, done?, due_at? }; partial
// DELETE /api/tasks/123   → remove

import { getUserEmail, json } from '../../_lib/auth';
import { buildPatch, type FieldSpec } from '../../_lib/patch';
import type { Env } from '../../_lib/types';

const FIELDS: Record<string, FieldSpec> = {
  text: { sql: 'text = ?', prep: (v) => (typeof v === 'string' ? v : null) },
  description: {
    sql: 'description = ?',
    prep: (v) => (v == null ? null : typeof v === 'string' && v.trim() ? v.trim() : null),
    nullable: true,
  },
  tag: { sql: 'tag = ?', prep: (v) => v ?? null, nullable: true },
  kind: { sql: 'kind = ?', prep: (v) => v ?? null, nullable: true },
  done: { sql: 'done = ?', prep: (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : null) },
  due_at: {
    sql: 'due_at = ?',
    prep: (v) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    },
    nullable: true,
  },
};

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const id = parseInt(String(params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'invalid id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { sets, binds } = buildPatch(body, FIELDS);
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
