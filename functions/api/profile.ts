// functions/api/profile.ts — list + create profile items for the current user.
// PATCH/DELETE for individual items live in profile/[id].ts.
//
// GET  /api/profile  → [{id, category, label, value, note, sort_order, updated_at}, …]
// POST /api/profile  → body: {label, value?, category?, note?, sort_order?}

import { getUserEmail, json } from '../_lib/auth';
import { asFiniteNumber, asString } from '../_lib/coerce';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db
    .prepare(
      `SELECT id, category, label, value, note, sort_order, updated_at
         FROM profile_items
        WHERE user_email = ?
     ORDER BY category, sort_order, id`,
    )
    .bind(email)
    .all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const label = asString(body?.label).trim();
  if (!label) {
    return json(
      { error: 'body must be { label: string, value?, category?, note?, sort_order? }' },
      { status: 400 },
    );
  }
  const category = asString(body?.category).trim() || null;
  const value = typeof body?.value === 'string' ? body.value : '';
  const note = asString(body?.note).trim() || null;
  const sort_order = asFiniteNumber(body?.sort_order, 0);

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO profile_items (user_email, category, label, value, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, category, label, value, note, sort_order)
    .run();

  return json({ id: meta.last_row_id, category, label, value, note, sort_order });
};
