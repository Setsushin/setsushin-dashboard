// functions/api/journal.ts — list + create journal entries for the current user.
// PATCH/DELETE for individual entries live in journal/[id].ts.
//
// GET  /api/journal  → [{id, title, body, tags[], created_at, updated_at}, …] newest first.
// POST /api/journal  → body: {body, title?, tags?}; returns the created row.

import { getUserEmail, json } from '../_lib/auth';
import { parseTags, serializeTags } from '../_lib/journal-tags';
import { asString } from '../_lib/coerce';
import type { Env } from '../_lib/types';

interface JournalRow {
  id: number;
  title: string | null;
  body: string;
  tags: string | null;
  created_at: number;
  updated_at: number;
}

function normalizeTitle(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  return input.trim() || null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const db = env.setsushin_dash;
  const { results } = await db
    .prepare(
      `SELECT id, title, body, tags, created_at, updated_at
         FROM journal_entries
        WHERE user_email = ?
     ORDER BY created_at DESC, id DESC`,
    )
    .bind(email)
    .all<JournalRow>();
  return json(
    results.map((r) => ({ ...r, tags: parseTags(r.tags) })),
    { headers: { 'cache-control': 'no-store' } },
  );
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const body = asString(payload?.body).trim();
  if (!body) {
    return json({ error: 'body must be { body: string, title?, tags?: string[] }' }, { status: 400 });
  }
  const title = normalizeTitle(payload?.title);
  const tags = serializeTags(payload?.tags);
  const now = Math.floor(Date.now() / 1000);
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO journal_entries (user_email, title, body, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, title, body, tags ?? null, now, now)
    .run();
  return json({
    id: meta.last_row_id,
    title,
    body,
    tags: parseTags(tags ?? null),
    created_at: now,
    updated_at: now,
  });
};
