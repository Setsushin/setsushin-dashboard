// functions/api/fx.js — exchange rates proxy (free, no key, hourly cached).
//
// GET /api/fx?base=JPY&symbols=USD,CNY
//   → { base, rates: { USD: number, CNY: number }, date, source, stale? }
//
// Upstream is api.frankfurter.app (ECB reference rates, daily). We cache
// for 1h at the edge so the widget polls hourly even if upstream is daily.
// On upstream error we serve a hardcoded fallback with stale:true so the
// dashboard never shows blank numbers.

import { json } from '../_lib/auth.js';

const UPSTREAM = 'https://api.frankfurter.app/latest';
const UA = 'Mozilla/5.0 (compatible; setsushin-dashboard/1.0)';
const CACHE_SECS = 3600;

// Very rough mid-2026 fallback. Update by hand if it drifts hard.
const FALLBACK = {
  base: 'JPY',
  rates: { USD: 0.00645, CNY: 0.0466 },
  date: 'fallback',
  source: 'hardcoded',
  stale: true,
};

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const base = (url.searchParams.get('base') || 'JPY').toUpperCase();
  const symbols = (url.searchParams.get('symbols') || 'USD,CNY').toUpperCase();

  try {
    const r = await fetch(`${UPSTREAM}?base=${base}&symbols=${symbols}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const j = await r.json();
    return json(
      { base: j.base, rates: j.rates, date: j.date, source: 'frankfurter.app' },
      { headers: { 'cache-control': `public, max-age=${CACHE_SECS}, s-maxage=${CACHE_SECS}` } },
    );
  } catch (e) {
    // Don't fail the widget — return the fallback labeled stale.
    return json(
      { ...FALLBACK, error: String(e?.message || e) },
      { headers: { 'cache-control': 'public, max-age=60' } },
    );
  }
}
