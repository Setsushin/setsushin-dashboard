// Shared partial-update builder for the `[id].ts` PATCH endpoints.
//
// Each field maps to a SQL fragment + a prep function that coerces the raw
// (untrusted) value. A prepared value of `null` is skipped unless the field
// is `nullable` (where null means "clear the column").

export interface FieldSpec {
  sql: string;
  prep: (v: unknown) => unknown;
  nullable?: boolean;
}

export function buildPatch(
  body: Record<string, unknown>,
  fields: Record<string, FieldSpec>,
): { sets: string[]; binds: unknown[] } {
  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    const spec = fields[key];
    if (!spec) continue; // ignore unknown fields silently
    const prepared = spec.prep(value);
    if (prepared == null && !spec.nullable) continue;
    sets.push(spec.sql);
    binds.push(prepared);
  }
  return { sets, binds };
}

export const trimmedOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

export const finiteOrNull = (v: unknown): number | null =>
  Number.isFinite(Number(v)) ? Number(v) : null;
