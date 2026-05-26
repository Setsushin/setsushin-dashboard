// functions/api/pages/[id].ts — upsert / delete one page's local metadata.
//
// PUT    /api/pages/<page_id>   body: { label?, icon?, title?, subtitle?, sort_order? }
// DELETE /api/pages/<page_id>   removes the meta row AND the matching
//                               layout_overrides row (fresh grid on re-add)
//
// PUT is full upsert: any field omitted from the body becomes NULL in D1.

import { getUserEmail, json } from '../../_lib/auth';
import { asFiniteNumber } from '../../_lib/coerce';
import type { Env } from '../../_lib/types';

const PAGE_ID_RE = /^[a-z0-9_-]+$/i;

const trim = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);

export const onRequestPut: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const page_id = String(params.id || '').trim();
  if (!PAGE_ID_RE.test(page_id)) {
    return json({ error: 'page_id must match /^[a-z0-9_-]+$/' }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return json({ error: 'body must be JSON' }, { status: 400 });
  }
  const fields = {
    label: trim(body.label) || null,
    icon: trim(body.icon) || null,
    title: trim(body.title) || null,
    subtitle: trim(body.subtitle) || null,
    sort_order: asFiniteNumber(body.sort_order, 100),
  };
  const db = env.setsushin_dash;
  await db
    .prepare(
      `INSERT INTO pages_local (user_email, page_id, label, icon, title, subtitle, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(user_email, page_id) DO UPDATE SET
         label      = excluded.label,
         icon       = excluded.icon,
         title      = excluded.title,
         subtitle   = excluded.subtitle,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
    )
    .bind(email, page_id, fields.label, fields.icon, fields.title, fields.subtitle, fields.sort_order)
    .run();
  return json({ ok: true, page_id, ...fields });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const page_id = String(params.id || '').trim();
  if (!PAGE_ID_RE.test(page_id)) {
    return json({ error: 'page_id must match /^[a-z0-9_-]+$/' }, { status: 400 });
  }
  const db = env.setsushin_dash;
  await db.prepare('DELETE FROM pages_local WHERE user_email = ? AND page_id = ?').bind(email, page_id).run();
  // Cascade: drop the page's grid override so re-adding the same id later
  // doesn't inherit a stale layout.
  await db
    .prepare('DELETE FROM layout_overrides WHERE user_email = ? AND page_id = ?')
    .bind(email, page_id)
    .run();
  return json({ ok: true, page_id });
};
