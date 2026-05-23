// functions/api/pages.js — list per-user page metadata.
// PUT/DELETE for individual pages live in pages/[id].js.
//
// GET  /api/pages  → [{page_id, label, icon, title, subtitle, sort_order}, …]
//
// Each row is either an override on a layout.yml page (matching page_id)
// or a user-added page (page_id not in yaml). The merge logic in
// useLayout (core.jsx) decides which.

import { getUserEmail, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db.prepare(
    `SELECT page_id, label, icon, title, subtitle, sort_order, updated_at
       FROM pages_local
      WHERE user_email = ?
   ORDER BY sort_order, page_id`
  ).bind(email).all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
}
