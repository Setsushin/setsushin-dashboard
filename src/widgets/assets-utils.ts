// widgets/assets-utils.ts — pure helpers for the Portfolio widget.

export type AmountUnit = 'man' | 'usd' | 'yen';

const round1 = (n: number) => Math.round(n * 10) / 10;

// Owner-confirmed shorthand: k = 千, m = 万 (NOT million — "$1m" is 1万 USD).
const MULT: Record<string, number> = { k: 1e3, m: 1e4 };

// Parse an amount entry into 万JPY. Plain number = defaultUnit; a $ / ¥
// symbol (prefix or suffix) always wins: $ = USD converted at usdPerJpy,
// ¥/￥ = raw yen. k/m suffixes scale the number (20k = 20,000 · 1.5m =
// 15,000); a k/m-suffixed bare number in 万円 context reads as 円, so
// "500m" means 500万円 rather than 500万×万. Commas and spaces are ignored.
// Returns null when unparseable, or USD is requested without a rate.
export function parseAmount(
  raw: string,
  usdPerJpy: number | undefined,
  defaultUnit: AmountUnit = 'man',
): number | null {
  const s = raw.replace(/[,\s]/g, '');
  const m = /^([$¥￥])?(-?(?:\d+\.?\d*|\.\d+))([km])?([$¥￥])?$/i.exec(s);
  if (!m || (m[1] && m[4])) return null;
  const v = parseFloat(m[2]) * (m[3] ? MULT[m[3].toLowerCase()] : 1);
  if (!Number.isFinite(v)) return null;
  const sym = m[1] || m[4];
  let unit: AmountUnit = sym === '$' ? 'usd' : sym ? 'yen' : defaultUnit;
  if (unit === 'man' && m[3]) unit = 'yen';
  if (unit === 'usd') return usdPerJpy ? round1(v / usdPerJpy / 1e4) : null;
  if (unit === 'yen') return round1(v / 1e4);
  return v;
}

// Inverse of parseAmount: display a 万JPY value in the given unit, so the
// form can convert the field in place when the unit select changes.
export function fromMan(man: number, unit: AmountUnit, usdPerJpy: number | undefined): number | null {
  if (unit === 'usd') return usdPerJpy ? round1(man * 1e4 * usdPerJpy) : null;
  if (unit === 'yen') return Math.round(man * 1e4);
  return man;
}
