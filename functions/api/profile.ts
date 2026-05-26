// functions/api/profile.ts — list + create profile items for the current user.
// PATCH/DELETE for individual items live in profile/[id].ts.
//
// GET  /api/profile  → [{id, category, label, value, note, sort_order, updated_at}, …]
// POST /api/profile  → body: {label, value?, category?, note?, sort_order?}

import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import { profileInsert } from '../_lib/schemas';
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
  const r = await parseJson(request, profileInsert);
  if (r.error) return r.error;
  const { label, category, value, note, sort_order } = r.data;

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO profile_items (user_email, category, label, value, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, category ?? null, label, value, note ?? null, sort_order)
    .run();

  return json({
    id: meta.last_row_id,
    category: category ?? null,
    label,
    value,
    note: note ?? null,
    sort_order,
  });
};
