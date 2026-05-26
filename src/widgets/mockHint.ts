// Derive a "(mock — reason)" hint from useFetch state + upstream sentinel
// (the case where the Worker returns 200 but every entry has an `error` field —
// see widgets/markets.tsx, widgets/calendar.tsx).

export interface MockHintInput {
  error?: Error | null;
  allErrored?: boolean;
  reason?: string;
}

export function mockHint({ error, allErrored, reason }: MockHintInput): string | null {
  if (!error && !allErrored) return null;
  const why =
    reason || error?.message || (allErrored ? 'upstream blocked' : '') || 'unreachable';
  return `(mock — ${why})`;
}
