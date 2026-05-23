// GET /api/markets?symbols=SPY,BTC-USD,JPY=X,^TNX,^N225
// Yahoo Finance v8 chart proxy with cookie + crumb auth (otherwise the
// public endpoint 429/403's anonymous IPs aggressively).
//
// Crumb is cached in module scope — persists per warm Worker isolate (a
// few minutes typically), refetched on cold start or 401/403. Phase 2
// candidate: KV-backed crumb cache so all colos share one.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const MAX_SYMBOLS = 20;
const CACHE_SECS = 300;
const CRUMB_TTL_MS = 2 * 60 * 60 * 1000; // 2h

let CRUMB_CACHE = { value: null, cookie: null, fetchedAt: 0 };

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('symbols') || '').trim();
  if (!raw) {
    return json({ error: 'symbols query param required, e.g. ?symbols=SPY,BTC-USD' }, 400);
  }
  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_SYMBOLS);

  // Try with current crumb; if any symbol returns 401/403 we refresh and retry.
  let creds = await getCrumb();
  let results = await Promise.all(symbols.map(s => fetchOne(s, creds)));

  if (results.some(r => r.error === 'upstream 401' || r.error === 'upstream 403')) {
    invalidateCrumb();
    creds = await getCrumb({ force: true });
    results = await Promise.all(symbols.map(s => fetchOne(s, creds)));
  }

  return json(results, 200, {
    'cache-control': `public, max-age=${CACHE_SECS}, s-maxage=${CACHE_SECS}`,
  });
}

async function fetchOne(symbol, creds) {
  try {
    const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
    if (creds?.cookie) headers['Cookie'] = creds.cookie;
    const qs = creds?.value ? `?crumb=${encodeURIComponent(creds.value)}` : '';
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${qs}`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return { symbol, error: `upstream ${r.status}` };
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta) return { symbol, error: 'no meta' };
    const price = meta.regularMarketPrice ?? null;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const change = (price != null && prev != null) ? price - prev : null;
    const changePercent = (change != null && prev) ? (change / prev) * 100 : null;
    return {
      symbol,
      price,
      previousClose: prev,
      change,
      changePercent,
      currency: meta.currency ?? null,
    };
  } catch (e) {
    return { symbol, error: String(e?.message || e) };
  }
}

// ── Crumb dance ────────────────────────────────────────────────────────
// 1) GET fc.yahoo.com → returns Set-Cookie with A1/A1S/A3 etc.
// 2) GET query1.finance.yahoo.com/v1/test/getcrumb (with cookie) → returns crumb token
// Use crumb + cookie in subsequent v8 chart calls.

export async function getCrumb({ force = false } = {}) {
  if (!force && CRUMB_CACHE.value && Date.now() - CRUMB_CACHE.fetchedAt < CRUMB_TTL_MS) {
    return CRUMB_CACHE;
  }

  try {
    // Step 1: pick up cookies. fc.yahoo.com 404s but still sets cookies.
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    const cookie = collectCookies(r1.headers);
    if (!cookie) return CRUMB_CACHE; // give up gracefully — fall back to anon (will 403)

    // Step 2: exchange cookie for crumb.
    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Accept': 'text/plain', 'Cookie': cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (!r2.ok) return CRUMB_CACHE;
    const crumb = (await r2.text()).trim();
    if (!crumb) return CRUMB_CACHE;

    CRUMB_CACHE = { value: crumb, cookie, fetchedAt: Date.now() };
    return CRUMB_CACHE;
  } catch {
    return CRUMB_CACHE;
  }
}

export function invalidateCrumb() {
  CRUMB_CACHE = { value: null, cookie: null, fetchedAt: 0 };
}

// Workers' fetch exposes set-cookie via headers.getSetCookie() on newer runtimes;
// older paths split on header name. We collect all and join into a single
// Cookie request header.
function collectCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const all = headers.getSetCookie();
    if (all && all.length) return all.map(c => c.split(';')[0]).join('; ');
  }
  // Fallback: single Set-Cookie header
  const single = headers.get('set-cookie');
  if (single) {
    return single.split(/,(?=\s*[A-Za-z0-9_-]+=)/).map(c => c.split(';')[0].trim()).join('; ');
  }
  return '';
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
