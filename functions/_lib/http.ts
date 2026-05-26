// functions/_lib/http.ts — boundary helpers for write endpoints: a uniform
// JSON error envelope and a path-id parser. Continues the parseJson
// `{data}|{error}` contract from parse.ts.

import { json } from './auth';

// Flat JSON error envelope shared by all write endpoints: { error, ...details }.
// Kept flat to stay compatible with the existing { error: string } shape
// (front-end reads none of it beyond r.ok, so zero client change).
export function httpError(status: number, error: string, details?: Record<string, unknown>): Response {
  return json({ error, ...details }, { status });
}

// Parse a positive-integer path id. Mirrors parseJson's result contract:
//   const p = parseId(params.id); if (p.error) return p.error; … p.id
export function parseId(
  raw: unknown,
): { id: number; error?: undefined } | { id?: undefined; error: Response } {
  const id = parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return { error: httpError(400, 'invalid id') };
  return { id };
}
