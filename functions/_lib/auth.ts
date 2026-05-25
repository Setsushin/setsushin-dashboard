// functions/_lib/auth.ts — single source of truth for "who is calling".
//
// Production: Cloudflare Access fronts the site, so every request carries a
// `Cf-Access-Jwt-Assertion` (and sometimes `Cf-Access-Authenticated-User-Email`)
// that CF has cryptographically verified upstream. We trust it.
//
// Local dev (`wrangler pages dev`): no Access in front, so the header is
// absent. We fall back to a fixed email so single-user dev "just works".
// Override via LOCAL_DEV_USER_EMAIL in wrangler.toml [vars].

import type { Env } from './types';

const LOCAL_DEFAULT = 'local@dev';

// CF Pages Functions receive `Cf-Access-Jwt-Assertion` (not the plaintext
// email header). We decode the JWT payload (no signature check) because
// Access 302s every unauthenticated request before the Function runs, so a
// JWT's presence here implies Access already authenticated the caller.
function emailFromAccessJwt(jwt: string | null): string | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64 + pad)) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export function getUserEmail(request: Request, env: Env): string {
  const fromHeader = request.headers.get('Cf-Access-Authenticated-User-Email');
  const fromJwt = emailFromAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'));
  return (fromHeader || fromJwt || env?.LOCAL_DEV_USER_EMAIL || LOCAL_DEFAULT).toLowerCase();
}

// Standard JSON response helper. Pages Functions don't have a built-in one.
export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });
}
