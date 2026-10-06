// Plumbing for the personal-dashboard-feed-digest skill. Run from the repo root.
//
//   node <this> items [--local]                        → items in the digest window, as JSON on stdout
//   node <this> publish <file.html> <items.json> [--local] → upload the report, update the index, advance the window
//
// Window: previous publish's window_end (R2 <email>/_state.json) → now, capped
// at 7 days. A rerun on the same JST day replaces that day's report, so it
// reuses that report's window_start instead. The Digest widget lists
// <email>/_index.json ([{date, headline}], newest first; headline = the
// report's <meta name="description">).
// --local targets wrangler's simulated bucket used by `npm run dev:cf`.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SOURCES, cleanText, fetchSource, type FeedItem } from '../../../../functions/api/feed.ts';

// Cloudflare Access email, lowercased — must match getUserEmail (functions/_lib/auth.ts).
const EMAIL = 'zousetsushin@gmail.com';
const BUCKET = 'setsushin-digests';
const DAY_MS = 86_400_000;
const JST_MS = 9 * 3_600_000;

const [cmd, ...rest] = process.argv.slice(2);
const local = rest.includes('--local');
const args = rest.filter((a) => a !== '--local');
const email = local ? 'local@dev' : EMAIL;

const wrangler = (argv: string[], input?: string): string =>
  execFileSync('npx', ['wrangler', ...argv, local ? '--local' : '--remote'], {
    input,
    encoding: 'utf8',
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });

const jst = (ms: number) => new Date(ms + JST_MS).toISOString();
const jstDate = (ms: number) => jst(ms).slice(0, 10);

// Missing object (first run, or expired by the bucket's 365d lifecycle) → undefined.
// Anything else (network, auth, bad JSON) throws: reading it as "missing" would
// rebuild the index from scratch or silently shrink the window.
function readJson<T>(name: string): T | undefined {
  let out: string;
  try {
    out = wrangler(['r2', 'object', 'get', `${BUCKET}/${email}/${name}`, '--pipe']);
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: string; stderr?: string };
    if (`${stdout}${stderr}`.includes('The specified key does not exist')) return undefined;
    throw e;
  }
  return JSON.parse(out);
}

const putJson = (name: string, value: unknown) =>
  wrangler(['r2', 'object', 'put', `${BUCKET}/${email}/${name}`, '--pipe', '--ct', 'application/json'],
    JSON.stringify(value));

async function items() {
  const end = Date.now();
  const state = readJson<{ window_start?: string; window_end: string }>('_state.json');
  const prevEnd = Date.parse(state?.window_end ?? '');
  let start = Number.isNaN(prevEnd) ? end - DAY_MS : prevEnd;
  if (!Number.isNaN(prevEnd) && jstDate(prevEnd) === jstDate(end)) start = Date.parse(state?.window_start ?? '') || start;
  start = Math.max(start, end - 7 * DAY_MS);

  const categories: Record<string, FeedItem[]> = {};
  for (const s of SOURCES) categories[s.category] ??= [];
  const failedSources: string[] = [];

  const results = await Promise.all(SOURCES.map(fetchSource));
  results.forEach((arr, i) => {
    if (!arr.length) failedSources.push(SOURCES[i].name);
    for (const it of arr) {
      const t = Date.parse(it.published);
      if (t > start && t <= end) categories[it.category].push(it);
    }
  });
  for (const list of Object.values(categories)) list.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));

  const label = (ms: number) => jst(ms).slice(5, 16).replace('-', '/').replace('T', ' ');
  console.log(JSON.stringify({
    date: jstDate(end),
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    windowLabel: `${label(start)} → ${label(end)} JST`,
    failedSources,
    categories,
  }, null, 2));
}

function publish(file: string | undefined, itemsFile: string | undefined) {
  if (!file || !itemsFile) throw new Error('usage: publish <file.html> <items.json>');
  const { windowStart, windowEnd } = JSON.parse(readFileSync(itemsFile, 'utf8'));
  const end = Date.parse(windowEnd);
  if (Number.isNaN(end) || Number.isNaN(Date.parse(windowStart))) throw new Error(`${itemsFile} has no window`);
  const date = jstDate(end);
  const headline = cleanText(/<meta name="description" content="([^"]*)"/.exec(readFileSync(file, 'utf8'))?.[1]);
  if (!headline) throw new Error(`${file} has no <meta name="description"> headline`);

  // Report → index → state: a failure part-way leaves the window unadvanced, so a rerun redoes it.
  const key = `${BUCKET}/${email}/${date}.html`;
  wrangler(['r2', 'object', 'put', key, '--file', file, '--ct', 'text/html; charset=utf-8']);

  const cutoff = jstDate(end - 365 * DAY_MS);
  const index = (readJson<{ date: string; headline: string }[]>('_index.json') ?? [])
    .filter((e) => e.date !== date && e.date > cutoff);
  index.push({ date, headline });
  index.sort((a, b) => b.date.localeCompare(a.date));
  putJson('_index.json', index);
  putJson('_state.json', { window_start: windowStart, window_end: windowEnd });
  console.log(`published ${key} — ${headline}`);
}

if (cmd === 'items') await items();
else if (cmd === 'publish') publish(args[0], args[1]);
else throw new Error('usage: items | publish <file.html> <items.json>');
