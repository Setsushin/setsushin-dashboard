// functions/api/bookmarks.js — list + create bookmarks for the current user.
// PATCH/DELETE for individual bookmarks live in bookmarks/[id].js.
//
// GET  /api/bookmarks?bucket=home    → [{id, name, url, mark, color, sort_order}, …]
// POST /api/bookmarks                → body: {bucket, name, url, mark?, color?, sort_order?}
//
// `bucket` is a free-form string (typically a page_id) that the bookmarks
// widget passes via its config. Pass `?bucket=` to list everything for the
// user (mostly debugging).

import { getUserEmail, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const email = getUserEmail(request, env);
  const bucket = new URL(request.url).searchParams.get('bucket');
  const db = env.setsushin_dash;
  const sql = bucket
    ? `SELECT id, bucket, name, url, mark, color, sort_order, updated_at
         FROM bookmarks_local
        WHERE user_email = ? AND bucket = ?
     ORDER BY sort_order, id`
    : `SELECT id, bucket, name, url, mark, color, sort_order, updated_at
         FROM bookmarks_local
        WHERE user_email = ?
     ORDER BY bucket, sort_order, id`;
  const stmt = bucket ? db.prepare(sql).bind(email, bucket)
                      : db.prepare(sql).bind(email);
  const { results } = await stmt.all();
  return json(results, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  const email = getUserEmail(request, env);
  const body = await request.json().catch(() => null);
  const bucket = (body?.bucket || '').trim();
  const name   = (body?.name   || '').trim();
  const url    = (body?.url    || '').trim();
  if (!bucket || !name || !url) {
    return json({ error: 'body must be { bucket, name, url, mark?, color?, sort_order? }' }, { status: 400 });
  }
  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `INSERT INTO bookmarks_local (user_email, bucket, name, url, mark, color, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    email, bucket, name, url,
    (body.mark  || '').trim() || null,
    (body.color || '').trim() || null,
    Number.isFinite(+body.sort_order) ? +body.sort_order : 0,
  ).run();
  return json({
    id: meta.last_row_id, bucket, name, url,
    mark:  body.mark  || null,
    color: body.color || null,
    sort_order: Number.isFinite(+body.sort_order) ? +body.sort_order : 0,
  });
}
