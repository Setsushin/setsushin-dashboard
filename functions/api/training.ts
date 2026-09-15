// functions/api/training.ts — per-user KV behind the training widget.
//
// GET /api/training → { weights: {...}, "log:2026-09-16": {...}, ... }
// PUT /api/training → body: { key, data }   key ∈ weights | log:YYYY-MM-DD

import { getUserEmail, json } from '../_lib/auth';
import { parseJson } from '../_lib/parse';
import { trainingPut } from '../_lib/schemas';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const { results } = await env.setsushin_dash
    .prepare('SELECT key, data FROM training_state WHERE user_email = ?')
    .bind(email)
    .all<{ key: string; data: string }>();
  const docs: Record<string, unknown> = {};
  for (const row of results) {
    try {
      docs[row.key] = JSON.parse(row.data);
    } catch {
      /* skip corrupt row */
    }
  }
  return json(docs, { headers: { 'cache-control': 'no-store' } });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);
  const r = await parseJson(request, trainingPut);
  if (r.error) return r.error;
  const { key, data } = r.data;
  await env.setsushin_dash
    .prepare(
      `INSERT INTO training_state (user_email, key, data, updated_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(user_email, key) DO UPDATE SET
         data       = excluded.data,
         updated_at = excluded.updated_at`,
    )
    .bind(email, key, JSON.stringify(data))
    .run();
  return json({ ok: true, key });
};
