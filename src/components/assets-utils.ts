// assets-utils.ts — pure helpers for the Portfolio component.

import type { AssetExposure } from '../types';

export type AmountUnit = 'man' | 'usd' | 'yen';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Owner-confirmed shorthand: k = 千, m = 万 (NOT million — "$1m" is 1万 USD).
const MULT: Record<string, number> = { k: 1e3, m: 1e4 };

// Parse an amount entry into its resolved unit. Plain number = defaultUnit;
// a $ / ¥ symbol (prefix or suffix) always wins: $ = USD, ¥/￥ = raw yen.
// k/m suffixes scale the number (20k = 20,000 · 1.5m = 15,000); a
// k/m-suffixed bare number in 万円 context reads as 円, so "500m" means
// 500万円 rather than 500万×万. Commas and spaces are ignored.
export function parseEntry(raw: string, defaultUnit: AmountUnit = 'man'): { value: number; unit: AmountUnit } | null {
  const s = raw.replace(/[,\s]/g, '');
  const m = /^([$¥￥])?(-?(?:\d+\.?\d*|\.\d+))([km])?([$¥￥])?$/i.exec(s);
  if (!m || (m[1] && m[4])) return null;
  const value = parseFloat(m[2]) * (m[3] ? MULT[m[3].toLowerCase()] : 1);
  if (!Number.isFinite(value)) return null;
  const sym = m[1] || m[4];
  let unit: AmountUnit = sym === '$' ? 'usd' : sym ? 'yen' : defaultUnit;
  if (unit === 'man' && m[3]) unit = 'yen';
  return { value, unit };
}

// USD-exposed fraction of a row; the rest is JPY-exposed.
const USD_SHARE: Record<AssetExposure, number> = { jpy: 0, usd: 1, 'mixed-50-50': 0.5 };

// Entry → stored parts. The total is split by exposure at today's rate:
// jpy_man holds the JPY-exposed part (万円), usd the USD-exposed part ($),
// so the row's JPY value floats with the rate regardless of how it was typed.
// Returns null when unparseable, or a rate is needed but missing.
export function parseAsset(
  raw: string,
  usdPerJpy: number | undefined,
  exposure: AssetExposure,
  defaultUnit: AmountUnit = 'man',
): { jpy_man: number; usd: number | null } | null {
  const e = parseEntry(raw, defaultUnit);
  if (!e) return null;
  const share = USD_SHARE[exposure];
  if (e.unit !== 'usd' && share === 0) return { jpy_man: round1(e.unit === 'yen' ? e.value / 1e4 : e.value), usd: null };
  if (!usdPerJpy) return null;
  const man = e.unit === 'usd' ? e.value / usdPerJpy / 1e4 : e.unit === 'yen' ? e.value / 1e4 : e.value;
  const usd = e.unit === 'usd' ? e.value * share : man * share * 1e4 * usdPerJpy;
  return { jpy_man: round1(man * (1 - share)), usd: share === 0 ? null : round2(usd) };
}

export function parseAmount(raw: string, usdPerJpy: number | undefined, defaultUnit: AmountUnit = 'man'): number | null {
  return parseAsset(raw, usdPerJpy, 'jpy', defaultUnit)?.jpy_man ?? null;
}

// Stored parts → live total in 万円 at the given rate.
export function liveMan(a: { jpy_man: number; usd?: number | null }, usdPerJpy: number): number {
  return round1(a.jpy_man + (a.usd ?? 0) / usdPerJpy / 1e4);
}

export function withLiveJpy<T extends { jpy_man: number; usd?: number | null }>(items: T[], usdPerJpy: number): T[] {
  return items.map((a) => ({ ...a, jpy_man: liveMan(a, usdPerJpy) }));
}

// Inverse of parseAmount: display a 万JPY value in the given unit, so the
// form can convert the field in place when the unit select changes.
export function fromMan(man: number, unit: AmountUnit, usdPerJpy: number | undefined): number | null {
  if (unit === 'usd') return usdPerJpy ? round1(man * 1e4 * usdPerJpy) : null;
  if (unit === 'yen') return Math.round(man * 1e4);
  return man;
}
