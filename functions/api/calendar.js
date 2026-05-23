// GET /api/calendar?source=<env-key>&limit=10              # single source
// GET /api/calendar?sources=primary,work&limit=10          # merged
//
// Fetches one or more ICS feeds (Google Calendar "secret address in iCal
// format" or any RFC 5545 ICS), parses VEVENTs, returns upcoming events
// merged + sorted by start time. Each event is tagged with `source` so
// the widget can color-code by feed.
//
// The actual ICS URLs live in Pages env vars (so they never leak into git
// even on a private repo). Set them in wrangler.toml [vars] for dev or
// CF Pages dashboard for prod, naming convention: CALENDAR_<KEY>_ICS.
// /api/calendar/sources lists which keys are currently bound (no URLs
// exposed).
//
// To fetch your Google Calendar's secret ICS URL:
//   Google Calendar → Settings → click your calendar → "Integrate calendar"
//   → "Secret address in iCal format" — that's the URL.

const UA = 'Mozilla/5.0 (compatible; setsushin-dashboard/1.0)';
const CACHE_SECS = 600;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const LOOKBACK_HOURS = 12;
const LOOKAHEAD_DAYS = 30;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
  // Accept either ?sources=a,b,c or ?source=a (legacy single). Empty/missing
  // falls back to "primary" for backwards compatibility.
  const raw = url.searchParams.get('sources') || url.searchParams.get('source') || 'primary';
  const keys = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  // Fetch + parse each source in parallel; one failure doesn't poison the rest.
  const perSource = await Promise.all(keys.map(async (key) => {
    const envVar = `CALENDAR_${key.toUpperCase()}_ICS`;
    const icsUrl = env?.[envVar];
    if (!icsUrl) return { key, events: [], error: `${envVar} not set` };
    try {
      const r = await fetch(icsUrl, {
        headers: { 'User-Agent': UA, 'Accept': 'text/calendar' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return { key, events: [], error: `upstream ${r.status}` };
      const ics = await r.text();
      return { key, events: parseICS(ics).map(e => ({ ...e, source: key })) };
    } catch (e) {
      return { key, events: [], error: String(e?.message || e) };
    }
  }));

  const errored = perSource.filter(s => s.error);
  // If every source failed, propagate. Otherwise merge what we got.
  if (errored.length === keys.length && keys.length > 0) {
    const detail = errored.map(s => `${s.key}: ${s.error}`).join('; ');
    // 400 if every key was simply unbound; 502 if upstreams failed.
    const allMissing = errored.every(s => s.error.endsWith('not set'));
    return json({ error: detail }, allMissing ? 400 : 502);
  }
  const merged = perSource.flatMap(s => s.events);
  const events = filterUpcoming(merged).slice(0, limit);
  return json(events, 200, {
    'cache-control': `public, max-age=${CACHE_SECS}, s-maxage=${CACHE_SECS}`,
  });
}

// ── ICS parser (RFC 5545, minimal) ────────────────────────────────────
// Handles VEVENT blocks, line folding (continuation lines start with space
// or tab), basic property params (DTSTART;TZID=...:...), CDATA-free.
// Skips VTIMEZONE/VALARM internals since we don't need them.

export function parseICS(ics) {
  // Unfold lines per RFC 5545 §3.1: CRLF + space/tab = continuation.
  const text = ics.replace(/\r?\n[ \t]/g, '');
  const events = [];
  for (const m of text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)) {
    const block = m[1];
    const start = parseICSDate(getProp(block, 'DTSTART'));
    if (!start) continue;
    const end = parseICSDate(getProp(block, 'DTEND')) || null;
    events.push({
      title: unescape(getProp(block, 'SUMMARY') || '(untitled)'),
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      location: unescape(getProp(block, 'LOCATION') || ''),
      description: unescape((getProp(block, 'DESCRIPTION') || '').slice(0, 240)),
      allDay: isAllDay(getProp(block, 'DTSTART', { withParams: true })),
    });
  }
  return events;
}

// `name` matches DTSTART, DTEND, SUMMARY, etc.
// Returns the value (after the colon), ignoring params unless withParams=true
// in which case returns the raw "DTSTART;TZID=...:value" line.
function getProp(block, name, { withParams = false } = {}) {
  const re = new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.+)$`, 'mi');
  const m = re.exec(block);
  if (!m) return null;
  if (!withParams) return m[1].trim();
  // Return whole matched line for params inspection
  const lineRe = new RegExp(`^${name}(?:;[^:\\r\\n]*)?:.+$`, 'mi');
  const lm = lineRe.exec(block);
  return lm ? lm[0].trim() : null;
}

function isAllDay(dtstartLine) {
  if (!dtstartLine) return false;
  return /VALUE=DATE/i.test(dtstartLine);
}

export function parseICSDate(s) {
  if (!s) return null;
  // Forms:
  //   20260428T140000Z   (UTC)
  //   20260428T140000    (local / floating; treat as UTC for sort stability)
  //   20260428           (date only)
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?/.exec(s);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  if (!hh) return new Date(Date.UTC(+y, +mo - 1, +d));
  return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
}

function unescape(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function filterUpcoming(events) {
  const now = Date.now();
  const lookback = now - LOOKBACK_HOURS * 3600_000;
  const lookahead = now + LOOKAHEAD_DAYS * 86400_000;
  return events
    .filter(e => {
      const t = new Date(e.start).getTime();
      return t >= lookback && t <= lookahead;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
