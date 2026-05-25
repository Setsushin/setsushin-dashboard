// functions/api/assets.ts — list + create portfolio assets for the current user.
// PATCH/DELETE for individual assets live in assets/[id].ts.
//
// GET  /api/assets  → [{id, layer, sublayer, name, jpy_man, exposure, account, sort_order}, …]
// POST /api/assets  → body: {layer, name, jpy_man, exposure, sublayer?, account?, sort_order?}

import { getUserEmail, json } from '../_lib/auth';
import { asFiniteNumber, asString } from '../_lib/coerce';
import type { Env } from '../_lib/types';

export const VALID_EXPOSURE = new Set(['jpy', 'usd', 'mixed-50-50']);

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
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const layer = asString(body?.layer).trim();
  const name = asString(body?.name).trim();
  const jpy_man = Number(body?.jpy_man);
  const exposure = asString(body?.exposure).trim().toLowerCase();

  if (!layer || !name || !Number.isFinite(jpy_man) || !VALID_EXPOSURE.has(exposure)) {
    return json(
      {
        error:
          'body must be { layer, name, jpy_man:number, exposure: jpy|usd|mixed-50-50, sublayer?, account?, sort_order? }',
      },
      { status: 400 },
    );
  }

  const sublayer = body?.sublayer != null ? String(body.sublayer) : null;
  const account = asString(body?.account).trim() || null;
  const sort_order = asFiniteNumber(body?.sort_order, 0);

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO assets (user_email, layer, sublayer, name, jpy_man, exposure, account, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, layer, sublayer, name, jpy_man, exposure, account, sort_order)
    .run();

  return json({ id: meta.last_row_id, layer, sublayer, name, jpy_man, exposure, account, sort_order });
};
