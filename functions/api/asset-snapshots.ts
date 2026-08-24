// functions/api/asset-snapshots.ts — dated snapshots of the assets table.
//
// GET  /api/asset-snapshots?days=N → [{id, taken_at, data: Asset[]}, …] oldest-first
// POST /api/asset-snapshots        → body: { usd_rate } (1 JPY in USD). Server reads
//                                    current assets, folds each row's usd part into
//                                    jpy_man at that rate, stores JSON. Same JST day
//                                    overwrites the earlier save.

import { z } from 'zod';
import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import type { Env } from '../_lib/types';

const snapshotBody = z.object({ usd_rate: z.coerce.number().positive() });

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
  const r = await parseJson(request, snapshotBody);
  if (r.error) return r.error;
  const rate = r.data.usd_rate;
  const db = env.setsushin_dash;
  const { results } = await db
    .prepare(
      `SELECT id, layer, sublayer, name, jpy_man, usd, exposure, account, sort_order, updated_at
         FROM assets
        WHERE user_email = ?
     ORDER BY layer, sort_order, id`,
    )
    .bind(email)
    .all<{ jpy_man: number; usd: number | null }>();
  const rows = results.map((a) => ({ ...a, jpy_man: Math.round((a.jpy_man + (a.usd ?? 0) / rate / 1e4) * 10) / 10 }));

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
    .bind(email, JSON.stringify(rows))
    .run();

  return json({ id: meta.last_row_id, taken_at: Math.floor(Date.now() / 1000), count: rows.length });
};
