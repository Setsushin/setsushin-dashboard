// Shared tag (de)serialization for the journal endpoints.
//
// Tags travel as a JSON-array TEXT column: clean, trim, drop empties; an empty
// array round-trips as NULL. PATCH and POST need identical semantics so they
// can't drift — keep this one helper as the only writer.
//
// serializeTags return contract:
//   undefined → "skip this column on PATCH"  (caller leaves the field unset)
//   null      → "clear this column"
//   string    → JSON-encoded cleaned array (or null if every entry was empty)

export function parseTags(s) {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter(t => typeof t === 'string') : [];
  } catch { return []; }
}

export function serializeTags(input) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!Array.isArray(input)) return undefined;
  const cleaned = input
    .map(t => typeof t === 'string' ? t.trim() : '')
    .filter(Boolean);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}
