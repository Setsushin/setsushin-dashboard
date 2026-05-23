#!/usr/bin/env node
// scripts/seed-assets.mjs — one-shot seed of the assets table from a markdown
// snapshot living elsewhere (default ~/assets.md).
//
// Usage:
//   node scripts/seed-assets.mjs                          # local default
//   node scripts/seed-assets.mjs --force                  # wipe + re-seed
//   node scripts/seed-assets.mjs --md path/to/assets.md   # other source
//   node scripts/seed-assets.mjs --url https://...        # other API base
//
// Requires wrangler dev to be running (default http://127.0.0.1:8787).
// The seed POSTs via /api/assets, so whoever the API treats as the current
// user (local@dev by default; CF-Access email in prod) becomes the owner.
//
// Idempotent: if /api/assets already has rows for the current user, the
// script aborts unless --force is passed.

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    force: { type: 'boolean', default: false },
    md:    { type: 'string' },
    url:   { type: 'string' },
  },
});
const FORCE = args.force;
const MD_PATH = args.md || resolve(homedir(), 'assets.md');
const BASE = args.url || process.env.SMOKE_URL || 'http://127.0.0.1:8787';

const EXPOSURE_MAP = {
  '日元': 'jpy',
  '非日元': 'usd',
};
function mapExposure(raw) {
  const t = raw.trim();
  if (EXPOSURE_MAP[t]) return EXPOSURE_MAP[t];
  if (/50\s*\/\s*50/.test(t)) return 'mixed-50-50';
  throw new Error(`unknown exposure: ${raw}`);
}

// Parse a markdown table. Returns the data rows as arrays of cell strings,
// skipping the header + the |---|---| separator row.
function parseTable(block) {
  const rows = block
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));
  if (rows.length < 3) return { headers: [], data: [] };
  const cells = (line) => line.slice(1, -1).split('|').map(s => s.trim());
  const headers = cells(rows[0]);
  const data = rows.slice(2).map(cells);
  return { headers, data };
}

function parseLayerHeading(line) {
  // "### L1 Cash — 200 万（12.0%）"
  const m = /^###\s+(L\d+)\s+(.+?)\s+[—-]/.exec(line);
  return m ? { code: m[1], label: m[2].trim() } : null;
}

function parseSublayer(cell) {
  // "**L1a** 生活缓冲（JPY 银行活期）" → "L1a"
  const m = /\*\*(L\d+[a-z])\*\*/.exec(cell);
  return m ? m[1] : null;
}

async function main() {
  const md = await readFile(MD_PATH, 'utf8');

  // Split into per-layer sections.
  const sections = [];
  const re = /^###\s+L\d+.*$/gm;
  const matches = [...md.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
    sections.push(md.slice(start, end));
  }

  const items = [];
  for (const sect of sections) {
    const head = parseLayerHeading(sect.split('\n')[0]);
    if (!head) continue;
    const { headers, data } = parseTable(sect);
    if (!data.length) continue;

    // Column index lookup — varies by section (L1 has 子层, others don't).
    const idx = (label) => headers.indexOf(label);
    const ci = {
      name: idx('资产'), amount: idx('金额'), exposure: idx('敞口'),
      account: idx('账户'), sublayer: idx('子层'),
    };

    for (let row = 0; row < data.length; row++) {
      const r = data[row];
      // Skip stray rows from sibling tables (e.g. the 汇总 block that
      // follows the last L<N> section — different column count).
      if (r.length !== headers.length) continue;
      const item = {
        layer:    head.code,
        sublayer: ci.sublayer >= 0 ? parseSublayer(r[ci.sublayer]) : null,
        name:     r[ci.name].replace(/\s*[（(].+?[)）]\s*$/, '').trim(),
        jpy_man:  Number(r[ci.amount].replace(/[^\d.]/g, '')),
        exposure: mapExposure(r[ci.exposure]),
        account:  r[ci.account] || null,
        sort_order: row,
      };
      if (!item.name || !Number.isFinite(item.jpy_man)) continue;
      items.push(item);
    }
  }

  console.log(`parsed ${items.length} assets from ${MD_PATH}`);

  // Idempotency check.
  const existing = await fetch(`${BASE}/api/assets`).then(r => r.json()).catch(() => []);
  if (Array.isArray(existing) && existing.length > 0 && !FORCE) {
    console.log(`✗ /api/assets already has ${existing.length} rows. Pass --force to wipe + re-seed.`);
    process.exit(1);
  }

  if (FORCE && Array.isArray(existing) && existing.length > 0) {
    console.log(`wiping ${existing.length} existing rows…`);
    for (const a of existing) {
      await fetch(`${BASE}/api/assets/${a.id}`, { method: 'DELETE' });
    }
  }

  let ok = 0, fail = 0;
  for (const item of items) {
    const r = await fetch(`${BASE}/api/assets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (r.ok) ok++;
    else { fail++; console.log(`  ✗ ${item.layer} ${item.name}: ${r.status} ${await r.text()}`); }
  }
  console.log(`✓ seeded ${ok} / ${items.length} (${fail} failed)`);
}

main().catch(e => { console.error(e); process.exit(1); });
