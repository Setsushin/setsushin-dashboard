// functions/_lib/parse.ts — two generic helpers wiring zod schemas
// (functions/_lib/schemas.ts) to Request bodies and SQL. Zod owns
// validation/coercion; these just move the result across the boundary.

import { z } from 'zod';
import { httpError } from './http';

// Read the JSON body and validate it against `schema`. On failure, hand back a
// ready-made 400 Response so callers can `if (r.error) return r.error;`.
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: undefined } | { data?: undefined; error: Response }> {
  const raw = await request.json().catch(() => null);
  const r = schema.safeParse(raw);
  if (!r.success) {
    return { error: httpError(400, 'invalid body', { issues: r.error.issues }) };
  }
  return { data: r.data };
}

// A validated patch partial → SQL `sets` + bind values. `cols` maps each key
// to its column name, optionally with an `enc` to encode the domain value for
// the DB (e.g. boolean→0/1, string[]→JSON). Zod already coerced/cleared, so
// every present key becomes one `set`.
type Col = string | { col: string; enc: (v: unknown) => unknown };

export function toSqlSet(data: Record<string, unknown>, cols: Record<string, Col>) {
  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    const c = cols[k];
    if (!c) continue;
    if (typeof c === 'string') {
      sets.push(`${c} = ?`);
      binds.push(v);
    } else {
      sets.push(`${c.col} = ?`);
      binds.push(c.enc(v));
    }
  }
  return { sets, binds };
}
