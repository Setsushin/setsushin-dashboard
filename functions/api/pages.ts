// functions/api/pages.ts — list per-user page metadata.
// PUT/DELETE for individual pages live in pages/[id].ts.
//
// GET /api/pages → [{page_id, label, icon, title, subtitle, sort_order}, …]

import { getUserEmail, json } from '../_lib/auth';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db
    .prepare(
      `SELECT page_id, label, icon, title, subtitle, sort_order, updated_at
         FROM pages_local
        WHERE user_email = ?
     ORDER BY sort_order, page_id`,
    )
    .bind(email)
    .all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
};
