// Tiny runtime coercion helpers for untrusted request bodies (system boundary).

export function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function asFiniteNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
