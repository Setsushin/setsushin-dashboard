// functions/api/layout.js — per-user, per-page grid override CRUD.
//
// `layout.yml` is the structural template (nav, page list, stats, default
// grids). This endpoint stores user-specific *overrides* of a page's grid.
// useLayout in core.jsx fetches both and merges per page.
//
// GET    /api/layout                → { "<page_id>": <grid_array>, ... }
// PUT    /api/layout                → body: { page_id, grid: [...] }
// DELETE /api/layout                → wipe all overrides for this user
// DELETE /api/layout?page_id=home   → wipe one page (= "reset to default")

import { getUserEmail, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db
    .prepare('SELECT page_id, grid_json FROM layout_overrides WHERE user_email = ?')
    .bind(email)
    .all();
  const overrides = {};
  for (const row of results) {
    try { overrides[row.page_id] = JSON.parse(row.grid_json); } catch {}
  }
  return json(overrides, {
    headers: { 'cache-control': 'no-store' },
  });
}

export async function onRequestPut({ request, env }) {
  const email = getUserEmail(request, env);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.page_id !== 'string' || !Array.isArray(body.grid)) {
    return json({ error: 'body must be { page_id: string, grid: array }' }, { status: 400 });
  }
  const db = env.setsushin_dash;
  await db
    .prepare(`
      INSERT INTO layout_overrides (user_email, page_id, grid_json, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(user_email, page_id) DO UPDATE SET
        grid_json  = excluded.grid_json,
        updated_at = excluded.updated_at
    `)
    .bind(email, body.page_id, JSON.stringify(body.grid))
    .run();
  return json({ ok: true, page_id: body.page_id });
}

export async function onRequestDelete({ request, env }) {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const url = new URL(request.url);
  const pageId = url.searchParams.get('page_id');
  if (pageId) {
    await db.prepare('DELETE FROM layout_overrides WHERE user_email = ? AND page_id = ?')
      .bind(email, pageId).run();
    return json({ ok: true, deleted: pageId });
  }
  await db.prepare('DELETE FROM layout_overrides WHERE user_email = ?')
    .bind(email).run();
  return json({ ok: true, deleted: 'all' });
}
