// functions/api/images/[id].ts — serve a journal inline image from R2.
//
// GET /api/images/<uuid> → the image bytes. The key is `${email}/${uuid}`,
// so ownership is enforced by construction: a caller can only ever read
// objects under their own email directory. <img> requests carry the CF
// Access cookie; getUserEmail resolves the same email the upload used
// (local dev → local@dev).

import { getUserEmail } from '../../_lib/auth';
import { httpError } from '../../_lib/http';
import type { Env } from '../../_lib/types';

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const obj = await env.JOURNAL_IMAGES.get(`${email}/${params.id}`);
  if (!obj) return httpError(404, 'not found');

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  // uuid keys are content-addressable-enough: bytes never change under a uuid.
  headers.set('cache-control', 'private, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
};
