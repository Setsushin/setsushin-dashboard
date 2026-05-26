// functions/api/fx.ts — exchange rates proxy (free, no key, hourly cached).
//
// GET /api/fx?base=JPY&symbols=USD,CNY
//   → { base, rates: { USD: number, CNY: number }, date, source, stale? }
//
// Upstream is api.frankfurter.app (ECB reference rates, daily). Cached 1h at
// the edge. On upstream error we serve a hardcoded fallback with stale:true
// so the dashboard never shows blank numbers.

import { json } from '../_lib/auth';

const UPSTREAM = 'https://api.frankfurter.app/latest';
const UA = 'Mozilla/5.0 (compatible; setsushin-dashboard/1.0)';
const CACHE_SECS = 3600;

interface FxResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
}

// Very rough mid-2026 fallback. Update by hand if it drifts hard.
const FALLBACK = {
  base: 'JPY',
  rates: { USD: 0.00645, CNY: 0.0466 },
  date: 'fallback',
  source: 'hardcoded',
  stale: true,
};

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const base = (url.searchParams.get('base') || 'JPY').toUpperCase();
  const symbols = (url.searchParams.get('symbols') || 'USD,CNY').toUpperCase();

  try {
    const r = await fetch(`${UPSTREAM}?base=${base}&symbols=${symbols}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const j = (await r.json()) as FxResponse;
    return json(
      { base: j.base, rates: j.rates, date: j.date, source: 'frankfurter.app' },
      { headers: { 'cache-control': `public, max-age=${CACHE_SECS}, s-maxage=${CACHE_SECS}` } },
    );
  } catch (e) {
    // Don't fail the widget — return the fallback labeled stale.
    return json(
      { ...FALLBACK, error: String((e as Error)?.message || e) },
      { headers: { 'cache-control': 'public, max-age=60' } },
    );
  }
};
