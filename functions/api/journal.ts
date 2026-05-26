// functions/api/journal.ts — list + create journal entries for the current user.
// PATCH/DELETE for individual entries live in journal/[id].ts.
//
// GET  /api/journal  → [{id, title, body, tags[], created_at, updated_at}, …] newest first.
// POST /api/journal  → body: {body, title?, tags?}; returns the created row.

import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import { journalInsert, rowToJournal, serializeTags, type JournalRow } from '../_lib/schemas';
import type { Env } from '../_lib/types';

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
  return json(results.map(rowToJournal), { headers: { 'cache-control': 'no-store' } });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const r = await parseJson(request, journalInsert);
  if (r.error) return r.error;
  const { body, title, tags } = r.data;
  const tagsSql = serializeTags(tags) ?? null;
  const now = Math.floor(Date.now() / 1000);
  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(
      `INSERT INTO journal_entries (user_email, title, body, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(email, title ?? null, body, tagsSql, now, now)
    .run();
  return json(
    rowToJournal({
      id: meta.last_row_id as number,
      title: title ?? null,
      body,
      tags: tagsSql,
      created_at: now,
      updated_at: now,
    }),
  );
};
