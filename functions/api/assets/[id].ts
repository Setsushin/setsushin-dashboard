// functions/api/assets/[id].ts — patch/delete a single asset by id.
//
// PATCH  /api/assets/123  → body: { layer?, sublayer?, name?, jpy_man?, exposure?, account?, sort_order? }
// DELETE /api/assets/123  → remove

import { getUserEmail, json } from '../../_lib/auth';
import { httpError, parseId } from '../../_lib/http';
import { parseJson, toSqlSet } from '../../_lib/parse';
import { assetPatch } from '../../_lib/schemas';
import type { Env } from '../../_lib/types';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const email = getUserEmail(request, env);
  const p = parseId(params.id);
  if (p.error) return p.error;
  const id = p.id;

  const r = await parseJson(request, assetPatch);
  if (r.error) return r.error;
  const { sets, binds } = toSqlSet(r.data, {
    layer: 'layer',
    sublayer: 'sublayer',
    name: 'name',
    jpy_man: 'jpy_man',
    exposure: 'exposure',
    account: 'account',
    sort_order: 'sort_order',
  });
  if (sets.length === 0) return httpError(400, 'no updatable fields');
  sets.push('updated_at = unixepoch()');

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare(`UPDATE assets SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`)
    .bind(...binds, id, email)
    .run();
  if (meta.changes === 0) return httpError(404, 'not found');
  return json({ ok: true, id });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ env, params, request }) => {
  const email = getUserEmail(request, env);
  const p = parseId(params.id);
  if (p.error) return p.error;
  const id = p.id;

  const db = env.setsushin_dash;
  const { meta } = await db
    .prepare('DELETE FROM assets WHERE id = ? AND user_email = ?')
    .bind(id, email)
    .run();
  if (meta.changes === 0) return httpError(404, 'not found');
  return json({ ok: true, id });
};
