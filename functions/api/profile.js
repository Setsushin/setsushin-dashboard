// functions/api/profile.js — list + create profile items for the current user.
// PATCH/DELETE for individual items live in profile/[id].js.
//
// GET  /api/profile                → [{id, category, label, value, note, sort_order, updated_at}, …]
// POST /api/profile                → body: {label, value?, category?, note?, sort_order?}

import { getUserEmail, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db.prepare(
    `SELECT id, category, label, value, note, sort_order, updated_at
       FROM profile_items
      WHERE user_email = ?
   ORDER BY category, sort_order, id`
  ).bind(email).all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  const email = getUserEmail(request, env);
  const body = await request.json().catch(() => null);
  const label = (body?.label || '').trim();
  if (!label) {
    return json({ error: 'body must be { label: string, value?, category?, note?, sort_order? }' }, { status: 400 });
  }
  const category = (body.category || '').trim() || null;
  const value = typeof body.value === 'string' ? body.value : '';
  const note = (body.note || '').trim() || null;
  const sort_order = Number.isFinite(+body.sort_order) ? +body.sort_order : 0;

  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `INSERT INTO profile_items (user_email, category, label, value, note, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(email, category, label, value, note, sort_order).run();

  return json({ id: meta.last_row_id, category, label, value, note, sort_order });
}
