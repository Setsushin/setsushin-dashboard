// GET /api/digests → [{ date, headline }], newest first.
// Reads `${email}/_index.json`, which the local feed-digest routine rewrites on
// every publish (R2 can't carry per-object metadata from the wrangler CLI).
// A corrupt index or entry is dropped rather than failing the list or the widget.

import { z } from 'zod';
import { getUserEmail, json } from '../_lib/auth';
import type { Env } from '../_lib/types';

const Entry = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), headline: z.string() });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const obj = await env.DIGESTS.get(`${getUserEmail(request, env)}/_index.json`);
  let index: unknown = [];
  try {
    if (obj) index = await obj.json();
  } catch {
    // unparseable index → empty list
  }
  return json(Array.isArray(index) ? index.filter((e) => Entry.safeParse(e).success) : []);
};
