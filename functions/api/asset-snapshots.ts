// functions/api/asset-snapshots.ts — dated snapshots of the assets table.
//
// GET  /api/asset-snapshots?days=N → [{id, taken_at, data: Asset[]}, …] oldest-first
// POST /api/asset-snapshots        → server reads current assets, stores JSON.
//                                    Same JST day overwrites the earlier save.

import { getUserEmail, json } from '../_lib/auth';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const days = Number(new URL(request.url).searchParams.get('days'));
  const since = Number.isFinite(days) && days > 0 ? `AND taken_at >= unixepoch() - ${Math.floor(days)} * 86400` : '';
  const { results } = await env.setsushin_dash
    .prepare(
      `SELECT id, taken_at, data
         FROM asset_snapshots
        WHERE user_email = ? ${since}
     ORDER BY taken_at ASC`,
    )
    .bind(email)
    .all<{ id: number; taken_at: number; data: string }>();
  return json(
    results.map((r) => ({ id: r.id, taken_at: r.taken_at, data: JSON.parse(r.data) as unknown })),
    { headers: { 'cache-control': 'no-store' } },
  );
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

  // ponytail: JST (+32400) hardcoded — single-user dashboard, user lives in JP.
  await db
    .prepare(
      `DELETE FROM asset_snapshots
        WHERE user_email = ?
          AND date(taken_at + 32400, 'unixepoch') = date(unixepoch() + 32400, 'unixepoch')`,
    )
    .bind(email)
    .run();
  const { meta } = await db
    .prepare(`INSERT INTO asset_snapshots (user_email, data) VALUES (?, ?)`)
    .bind(email, JSON.stringify(results))
    .run();

  return json({ id: meta.last_row_id, taken_at: Math.floor(Date.now() / 1000), count: results.length });
};
