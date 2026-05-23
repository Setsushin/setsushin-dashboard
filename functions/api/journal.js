// functions/api/journal.js — list + create journal entries for the current user.
// PATCH/DELETE for individual entries live in journal/[id].js.
//
// GET  /api/journal          → [{id, title, body, tags[], created_at, updated_at}, …]
//                              newest first.
// POST /api/journal          → body: {body, title?, tags?}; returns the created row.

import { getUserEmail, json } from '../_lib/auth.js';
import { parseTags, serializeTags } from '../_lib/journal-tags.js';

function normalizeTitle(input) {
  if (typeof input !== 'string') return null;
  const t = input.trim();
  return t || null;
}

export async function onRequestGet({ request, env }) {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db.prepare(
    `SELECT id, title, body, tags, created_at, updated_at
       FROM journal_entries
      WHERE user_email = ?
   ORDER BY created_at DESC, id DESC`
  ).bind(email).all();
  return json(results.map(r => ({ ...r, tags: parseTags(r.tags) })), {
    headers: { 'cache-control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  const email = getUserEmail(request, env);
  const payload = await request.json().catch(() => null);
  const body = (payload?.body || '').trim();
  if (!body) {
    return json({ error: 'body must be { body: string, title?, tags?: string[] }' }, { status: 400 });
  }
  const title = normalizeTitle(payload?.title);
  const tags = serializeTags(payload?.tags);
  const now = Math.floor(Date.now() / 1000);
  const db = env.setsushin_dash;
  const { meta } = await db.prepare(
    `INSERT INTO journal_entries (user_email, title, body, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(email, title, body, tags ?? null, now, now).run();
  return json({
    id: meta.last_row_id,
    title,
    body,
    tags: parseTags(tags ?? null),
    created_at: now,
    updated_at: now,
  });
}
