// functions/api/bookmarks.ts — list + create bookmarks for the current user.
// PATCH/DELETE for individual bookmarks live in bookmarks/[id].ts.
//
// GET  /api/bookmarks?bucket=home  → [{id, name, url, mark, color, sort_order}, …]
// POST /api/bookmarks              → body: {bucket, name, url, mark?, color?, sort_order?}

import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import { bookmarkInsert } from '../_lib/schemas';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const bucket = new URL(request.url).searchParams.get('bucket');
  const db = env.setsushin_dash;
  const stmt = bucket
    ? db
        .prepare(
          `SELECT id, bucket, name, url, mark, color, sort_order, updated_at
             FROM bookmarks_local
            WHERE user_email = ? AND bucket = ?
         ORDER BY sort_order, id`,
        )
        .bind(email, bucket)
    : db
        .prepare(
          `SELECT id, bucket, name, url, mark, color, sort_order, updated_at
             FROM bookmarks_local
            WHERE user_email = ?
         ORDER BY bucket, sort_order, id`,
        )
        .bind(email);
  const { results } = await stmt.all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const r = await parseJson(request, bookmarkInsert);
  if (r.error) return r.error;
  const { bucket, name, url, mark, color, sort_order } = r.data;
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO bookmarks_local (user_email, bucket, name, url, mark, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, bucket, name, url, mark ?? null, color ?? null, sort_order)
    .run();
  return json({
    id: meta.last_row_id,
    bucket,
    name,
    url,
    mark: mark ?? null,
    color: color ?? null,
    sort_order,
  });
};
