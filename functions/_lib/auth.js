// functions/_lib/auth.js — single source of truth for "who is calling".
//
// Production: Cloudflare Access fronts the site, so every request to a
// Pages Function carries a `Cf-Access-Authenticated-User-Email` header
// that CF has cryptographically verified upstream. We trust it.
//
// Local dev (`wrangler pages dev .`): there is no Access in front, so the
// header is absent. We fall back to a fixed email so single-user dev
// scenarios "just work" without ceremony.
//
// To impersonate another user locally, set LOCAL_DEV_USER_EMAIL in
// wrangler.toml [vars] (or via `wrangler pages dev . --var ...`).
//
const LOCAL_DEFAULT = 'local@dev';

// CF Pages Functions, unlike Workers behind regular Access, do NOT receive
// the plaintext Cf-Access-Authenticated-User-Email header — only
// Cf-Access-Jwt-Assertion. We decode the JWT payload (no signature check)
// because Access 302s every unauthenticated request before the Function
// runs, so a JWT's presence at this point implies Access has already
// authenticated the caller.
function emailFromAccessJwt(jwt) {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    return JSON.parse(atob(b64 + pad)).email || null;
  } catch {
    return null;
  }
}

export function getUserEmail(request, env) {
  const fromHeader = request.headers.get('Cf-Access-Authenticated-User-Email');
  const fromJwt = emailFromAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'));
  return (fromHeader || fromJwt || env?.LOCAL_DEV_USER_EMAIL || LOCAL_DEFAULT).toLowerCase();
}

// Standard JSON response helper. Pages Functions don't have a built-in one.
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}
