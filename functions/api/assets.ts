// functions/api/assets.ts — list + create portfolio assets for the current user.
// PATCH/DELETE for individual assets live in assets/[id].ts.
//
// GET  /api/assets  → [{id, layer, sublayer, name, jpy_man, exposure, account, sort_order}, …]
// POST /api/assets  → body: {layer, name, jpy_man, exposure, sublayer?, account?, sort_order?}

import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import { assetInsert } from '../_lib/schemas';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db
    .prepare(
      `SELECT id, layer, sublayer, name, jpy_man, exposure, account, sort_order, updated_at
         FROM assets
        WHERE user_email = ?
     ORDER BY layer, sort_order, id`,
    )
    .bind(email)
    .all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const r = await parseJson(request, assetInsert);
  if (r.error) return r.error;
  const { layer, name, jpy_man, exposure, sublayer, account, sort_order } = r.data;

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO assets (user_email, layer, sublayer, name, jpy_man, exposure, account, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, layer, sublayer ?? null, name, jpy_man, exposure, account ?? null, sort_order)
    .run();

  return json({
    id: meta.last_row_id,
    layer,
    sublayer: sublayer ?? null,
    name,
    jpy_man,
    exposure,
    account: account ?? null,
    sort_order,
  });
};
