// functions/api/images.ts — upload a journal inline image to R2.
//
// POST /api/images  → body is the raw image bytes, Content-Type: image/*.
//                     Returns { url: '/api/images/<uuid>' }; the per-user
//                     directory is implied server-side, never in the URL.
// Read back via images/[id].ts. No D1 — the markdown reference in the
// journal body is the only record that an image exists.

import { getUserEmail, json } from '../_lib/auth';
import { httpError } from '../_lib/http';
import type { Env } from '../_lib/types';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX = 8 * 1024 * 1024; // 8MB — fits worker memory + Free-plan request cap.

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = getUserEmail(request, env);

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED.has(contentType)) return httpError(400, 'unsupported image type');

  const buf = await request.arrayBuffer();
  if (buf.byteLength === 0) return httpError(400, 'empty body');
  if (buf.byteLength > MAX) return httpError(413, 'image too large');

  const uuid = crypto.randomUUID();
  await env.JOURNAL_IMAGES.put(`${email}/${uuid}`, buf, {
    httpMetadata: { contentType },
  });
  return json({ url: `/api/images/${uuid}` });
};
