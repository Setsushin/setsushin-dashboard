#!/usr/bin/env node
// scripts/smoke.mjs — post-feature verification.
//
// Run after every feature commit:    npm run smoke
//
// What it does:
//   1. Asserts wrangler dev is up at $SMOKE_URL (default http://127.0.0.1:8787)
//   2. Hits every static asset + Function endpoint and checks status / shape
//   3. Round-trips /api/layout (PUT → GET → DELETE → GET) — D1 + auth
//      together, so any regression in either lights up here
//
// Exits 0 on green, 1 on first red. Designed to be cheap (~2s).
//
// NOT covered (still call npm test for these):
//   - parseICS / parseFeed unit tests
//   - markets crumb dance (upstream-blocked from this Mac, false positive)

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:8787';

let pass = 0, fail = 0;
const fails = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`); }
  else    { fail++; fails.push(`${name}${detail ? ' — ' + detail : ''}`);
            process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' \x1b[2m— ' + detail + '\x1b[0m' : ''}\n`); }
}

async function fetchOK(path, expect = 200) {
  try {
    const r = await fetch(BASE + path, { signal: AbortSignal.timeout(5000) });
    return { ok: r.status === expect, status: r.status, body: await r.text() };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e.message };
  }
}

async function fetchJSON(path, init) {
  try {
    const r = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(5000) });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, json, body: text };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e.message };
  }
}

console.log(`\n  smoke @ ${BASE}\n`);

// 1. Static assets — the SPA shell + runtime-fetched files served from the
// Vite build output (dist/). The bundled JS/CSS have content-hashed names,
// so instead of hardcoding them we assert index.html ships a module script
// (i.e. the build deployed) and the data files Pages serves verbatim resolve.
console.log('  static assets');
{
  const root = await fetchOK('/');
  check('GET / (SPA shell)', root.ok, root.ok ? '' : `${root.status}`);
  check('/ references a bundled module script',
        /<script type="module"[^>]*src="\/assets\//.test(root.body),
        'index.html has no /assets/*.js module script');
}
for (const p of ['/layout.yml', '/schedule.yml', '/icons/home.svg']) {
  const r = await fetchOK(p);
  check(`GET ${p}`, r.ok, r.error || (r.ok ? '' : `${r.status}`));
}

// 2. Pages Functions reachable. /api/layout, /api/tasks, /api/assets are
// fully self-contained (D1 only, no upstream). /api/fx hits a public API
// but always returns 200 (falls back to hardcoded rates on error). /api/feed
// and /api/calendar hit external services that are commonly blocked from
// this Mac's proxy — we just check they don't 500, accepting any 2xx/4xx
// as "function ran".
console.log('\n  functions');
{
  const layout = await fetchOK('/api/layout');
  check('GET /api/layout (D1)', layout.ok, layout.ok ? '' : `${layout.status}`);
  const fx = await fetchJSON('/api/fx');
  check('GET /api/fx (always 200, may be stale)',
        fx.ok && typeof fx.json?.rates?.USD === 'number',
        fx.ok ? '' : `${fx.status} ${JSON.stringify(fx.json)}`);
  // Calendar source catalog: always 200 (returns [] when no env vars bound).
  const calSrc = await fetchJSON('/api/calendar/sources');
  check('GET /api/calendar/sources (always 200, list of bound CALENDAR_*_ICS)',
        calSrc.ok && Array.isArray(calSrc.json),
        `${calSrc.status} ${JSON.stringify(calSrc.json)}`);
}
for (const p of ['/api/feed', '/api/calendar?source=primary&limit=2']) {
  const r = await fetch(BASE + p, { signal: AbortSignal.timeout(15000) }).catch(e => ({ status: 0, error: e.message }));
  // Allow 200..499 (function ran, even if upstream errored or env var missing).
  // Reject 500+ (function crashed) and 0 (timeout — usually proxy issue).
  const reachable = r.status > 0 && r.status < 500;
  const note = reachable ? `${r.status}` : (r.error || `${r.status}`);
  check(`GET ${p} (function reachable, upstream may fail)`, reachable, note);
}

// 3. Source code does NOT leak — paths outside public/ should fall back
// to index.html (status 200 but body is HTML), or 404.
console.log('\n  source code is fenced off');
for (const p of ['/migrations/0001_init.sql', '/migrations/0003_pages.sql',
                 '/migrations/0007_profile.sql',
                 '/test/parseFeed.test.ts', '/src/main.tsx', '/src/App.tsx',
                 '/package.json', '/wrangler.toml', '/functions/api/feed.ts',
                 '/functions/api/pages/[id].ts', '/functions/api/profile/[id].ts']) {
  const r = await fetchOK(p);
  const isHtmlFallback = r.body.startsWith('<!DOCTYPE html>') || r.body.startsWith('<html');
  const is404 = r.status === 404;
  check(`${p} (fallback or 404)`, isHtmlFallback || is404,
        `got ${r.status} body=${r.body.slice(0, 30).replace(/\n/g, ' ')}…`);
}

// 4. /api/layout round-trip — D1 + auth + Function together.
console.log('\n  /api/layout CRUD round-trip');
{
  await fetchJSON('/api/layout', { method: 'DELETE' });

  const initial = await fetchJSON('/api/layout');
  check('GET initial → {}', initial.ok && JSON.stringify(initial.json) === '{}',
        `got ${JSON.stringify(initial.json)}`);

  const put = await fetchJSON('/api/layout', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ page_id: 'smoke', grid: [{ type: 'tasks', size: 'compact' }] }),
  });
  check('PUT smoke → ok', put.ok && put.json?.ok === true,
        `got ${put.status} ${JSON.stringify(put.json)}`);

  const after = await fetchJSON('/api/layout');
  const got = after.json?.smoke;
  check('GET after PUT → smoke override present',
        Array.isArray(got) && got[0]?.type === 'tasks' && got[0]?.size === 'compact',
        `got ${JSON.stringify(after.json)}`);

  const del = await fetchJSON('/api/layout?page_id=smoke', { method: 'DELETE' });
  check('DELETE smoke → ok', del.ok && del.json?.deleted === 'smoke',
        `got ${JSON.stringify(del.json)}`);

  const final = await fetchJSON('/api/layout');
  check('GET final → {}', final.ok && JSON.stringify(final.json) === '{}',
        `got ${JSON.stringify(final.json)}`);

  const bad = await fetchJSON('/api/layout', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ oops: true }),
  });
  check('PUT bad body → 400', bad.status === 400, `got ${bad.status}`);
}

// 5. /api/tasks round-trip — POST → GET → PATCH → GET → DELETE → GET.
console.log('\n  /api/tasks CRUD round-trip');
{
  // Capture initial set so we can scope cleanup to what this run created.
  const before = await fetchJSON('/api/tasks');
  const beforeIds = new Set((before.json || []).map(t => t.id));

  const dueAt = Math.floor(Date.now() / 1000) + 86400;
  const created = await fetchJSON('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'smoke-task', description: 'smoke-desc', tag: 'Smoke', kind: 'work',
      due_at: dueAt,
    }),
  });
  check('POST → row with id + done:false + description + due_at',
        created.ok && Number.isInteger(created.json?.id)
          && created.json.done === false
          && created.json.description === 'smoke-desc'
          && created.json.due_at === dueAt,
        `got ${created.status} ${JSON.stringify(created.json)}`);
  const id = created.json?.id;

  const list = await fetchJSON('/api/tasks');
  const found = (list.json || []).find(t => t.id === id);
  check('GET shows new task',
        found && found.text === 'smoke-task' && found.done === false
          && found.description === 'smoke-desc' && found.due_at === dueAt,
        `got ${JSON.stringify(found)}`);

  const newDue = dueAt + 3600;
  const patched = await fetchJSON(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ done: true, description: 'smoke-desc-2', due_at: newDue }),
  });
  check('PATCH done+description+due_at → ok', patched.ok && patched.json?.ok === true,
        `got ${patched.status} ${JSON.stringify(patched.json)}`);

  const list2 = await fetchJSON('/api/tasks');
  const after = (list2.json || []).find(t => t.id === id);
  check('GET reflects PATCH (done + description + due_at)',
        after?.done === true && after?.description === 'smoke-desc-2' && after?.due_at === newDue,
        `got ${JSON.stringify(after)}`);

  const cleared = await fetchJSON(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description: null, due_at: null }),
  });
  check('PATCH null clears description + due_at', cleared.ok && cleared.json?.ok === true,
        `got ${cleared.status} ${JSON.stringify(cleared.json)}`);

  const list2b = await fetchJSON('/api/tasks');
  const cleared2 = (list2b.json || []).find(t => t.id === id);
  check('GET reflects null clear', cleared2?.description == null && cleared2?.due_at == null,
        `got ${JSON.stringify(cleared2)}`);

  const del = await fetchJSON(`/api/tasks/${id}`, { method: 'DELETE' });
  check('DELETE → ok', del.ok && del.json?.id === id, `got ${JSON.stringify(del.json)}`);

  const list3 = await fetchJSON('/api/tasks');
  const remaining = (list3.json || []).filter(t => !beforeIds.has(t.id));
  check('GET no smoke task remains', remaining.length === 0,
        `leftover: ${JSON.stringify(remaining)}`);

  const bad = await fetchJSON('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  check('POST empty body → 400', bad.status === 400, `got ${bad.status}`);

  const nf = await fetchJSON('/api/tasks/9999999', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ done: true }),
  });
  check('PATCH non-existent → 404', nf.status === 404, `got ${nf.status}`);
}

// 6b. /api/bookmarks CRUD — POST → GET (filtered by bucket) → PATCH →
//     GET → DELETE → GET (gone). Plus 400 negative cases.
console.log('\n  /api/bookmarks CRUD round-trip');
{
  const bucket = `smoke_${Date.now()}`;
  const before = await fetchJSON(`/api/bookmarks?bucket=${bucket}`);
  check('GET empty bucket → []',
        before.ok && Array.isArray(before.json) && before.json.length === 0,
        `got ${JSON.stringify(before.json)}`);

  const created = await fetchJSON('/api/bookmarks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bucket, name: 'Smoke', url: 'example.com', mark: 'S', color: '#abc' }),
  });
  check('POST → row with id + bucket',
        created.ok && Number.isInteger(created.json?.id) && created.json.bucket === bucket,
        `got ${created.status} ${JSON.stringify(created.json)}`);
  const id = created.json?.id;

  const list = await fetchJSON(`/api/bookmarks?bucket=${bucket}`);
  check('GET (bucket-filtered) shows new bookmark',
        list.ok && list.json?.length === 1 && list.json[0].name === 'Smoke',
        `got ${JSON.stringify(list.json)}`);

  const patched = await fetchJSON(`/api/bookmarks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke 2', mark: 'X' }),
  });
  check('PATCH name+mark → ok', patched.ok && patched.json?.ok === true,
        `got ${patched.status} ${JSON.stringify(patched.json)}`);

  const list2 = await fetchJSON(`/api/bookmarks?bucket=${bucket}`);
  const after = list2.json?.[0];
  check('GET reflects patched values',
        after?.name === 'Smoke 2' && after?.mark === 'X',
        `got ${JSON.stringify(after)}`);

  const del = await fetchJSON(`/api/bookmarks/${id}`, { method: 'DELETE' });
  check('DELETE → ok', del.ok && del.json?.id === id,
        `got ${JSON.stringify(del.json)}`);

  const list3 = await fetchJSON(`/api/bookmarks?bucket=${bucket}`);
  check('GET after DELETE → []',
        list3.ok && list3.json?.length === 0,
        `got ${JSON.stringify(list3.json)}`);

  const bad = await fetchJSON('/api/bookmarks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bucket, name: 'no url' }),
  });
  check('POST missing url → 400', bad.status === 400, `got ${bad.status}`);

  const nf = await fetchJSON('/api/bookmarks/9999999', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'x' }),
  });
  check('PATCH non-existent → 404', nf.status === 404, `got ${nf.status}`);
}

// 6. /api/pages CRUD — PUT (create) → GET (find row) → PUT (update) →
//    GET (verify) → DELETE → GET (no row). Plus 400 negative cases.
console.log('\n  /api/pages CRUD round-trip');
{
  const id = `smoke_${Date.now()}`;
  const before = await fetchJSON('/api/pages');
  const beforeIds = new Set((before.json || []).map(p => p.page_id));

  const put = await fetchJSON(`/api/pages/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'Smoke', icon: 'icons/more.svg', title: 'T' }),
  });
  check('PUT new page → ok', put.ok && put.json?.ok === true,
        `got ${put.status} ${JSON.stringify(put.json)}`);

  const list = await fetchJSON('/api/pages');
  const found = (list.json || []).find(p => p.page_id === id);
  check('GET shows new page',
        found && found.label === 'Smoke' && found.title === 'T',
        `got ${JSON.stringify(found)}`);

  const updated = await fetchJSON(`/api/pages/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'Smoke 2', icon: 'icons/more.svg', title: 'T2', subtitle: 'sub' }),
  });
  check('PUT (update) → ok', updated.ok && updated.json?.ok === true,
        `got ${updated.status} ${JSON.stringify(updated.json)}`);

  const list2 = await fetchJSON('/api/pages');
  const after = (list2.json || []).find(p => p.page_id === id);
  check('GET reflects update',
        after?.label === 'Smoke 2' && after?.subtitle === 'sub',
        `got ${JSON.stringify(after)}`);

  const del = await fetchJSON(`/api/pages/${id}`, { method: 'DELETE' });
  check('DELETE → ok', del.ok && del.json?.ok === true && del.json?.page_id === id,
        `got ${JSON.stringify(del.json)}`);

  const list3 = await fetchJSON('/api/pages');
  const remaining = (list3.json || []).filter(p => !beforeIds.has(p.page_id));
  check('GET no smoke page remains', remaining.length === 0,
        `leftover: ${JSON.stringify(remaining)}`);

  const bad = await fetchJSON('/api/pages/!!bad!!', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'x' }),
  });
  check('PUT bad page_id → 400', bad.status === 400, `got ${bad.status}`);
}

// 7. /api/assets round-trip — POST → GET → PATCH → GET → DELETE → GET.
// Scoped to what this run created so we don't trample seeded portfolio rows.
console.log('\n  /api/assets CRUD round-trip');
{
  const before = await fetchJSON('/api/assets');
  const beforeIds = new Set((before.json || []).map(a => a.id));

  const created = await fetchJSON('/api/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      layer: 'L1', sublayer: 'L1a', name: 'smoke-asset',
      jpy_man: 7, exposure: 'jpy', account: 'smoke', sort_order: 999,
    }),
  });
  check('POST → row with id + jpy_man:7',
        created.ok && Number.isInteger(created.json?.id) && created.json.jpy_man === 7,
        `got ${created.status} ${JSON.stringify(created.json)}`);
  const id = created.json?.id;

  const list = await fetchJSON('/api/assets');
  const found = (list.json || []).find(a => a.id === id);
  check('GET shows new asset',
        found && found.name === 'smoke-asset' && found.exposure === 'jpy',
        `got ${JSON.stringify(found)}`);

  const patched = await fetchJSON(`/api/assets/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jpy_man: 11.5, exposure: 'usd' }),
  });
  check('PATCH jpy_man + exposure → ok', patched.ok && patched.json?.ok === true,
        `got ${patched.status} ${JSON.stringify(patched.json)}`);

  const list2 = await fetchJSON('/api/assets');
  const after = (list2.json || []).find(a => a.id === id);
  check('GET reflects patched values',
        after?.jpy_man === 11.5 && after?.exposure === 'usd',
        `got ${JSON.stringify(after)}`);

  const del = await fetchJSON(`/api/assets/${id}`, { method: 'DELETE' });
  check('DELETE → ok', del.ok && del.json?.id === id, `got ${JSON.stringify(del.json)}`);

  const list3 = await fetchJSON('/api/assets');
  const remaining = (list3.json || []).filter(a => !beforeIds.has(a.id));
  check('GET no smoke asset remains', remaining.length === 0,
        `leftover: ${JSON.stringify(remaining)}`);

  const bad = await fetchJSON('/api/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ layer: 'L1', name: 'x', exposure: 'gbp', jpy_man: 1 }),
  });
  check('POST bad exposure → 400', bad.status === 400, `got ${bad.status}`);

  const nf = await fetchJSON('/api/assets/9999999', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jpy_man: 1 }),
  });
  check('PATCH non-existent → 404', nf.status === 404, `got ${nf.status}`);
}

// 8. /api/profile round-trip — POST → GET → PATCH → GET → DELETE → GET.
// Scoped to what this run created so we don't trample real profile rows.
console.log('\n  /api/profile CRUD round-trip');
{
  const before = await fetchJSON('/api/profile');
  const beforeIds = new Set((before.json || []).map(p => p.id));

  const created = await fetchJSON('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      category: 'Smoke', label: 'smoke-label', value: 'smoke-value', note: 'smoke-note',
    }),
  });
  check('POST → row with id + value',
        created.ok && Number.isInteger(created.json?.id)
          && created.json.label === 'smoke-label'
          && created.json.value === 'smoke-value'
          && created.json.category === 'Smoke',
        `got ${created.status} ${JSON.stringify(created.json)}`);
  const id = created.json?.id;

  const list = await fetchJSON('/api/profile');
  const found = (list.json || []).find(p => p.id === id);
  check('GET shows new item',
        found && found.label === 'smoke-label' && found.note === 'smoke-note',
        `got ${JSON.stringify(found)}`);

  const patched = await fetchJSON(`/api/profile/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'smoke-value-2', category: null }),
  });
  check('PATCH value + null category → ok', patched.ok && patched.json?.ok === true,
        `got ${patched.status} ${JSON.stringify(patched.json)}`);

  const list2 = await fetchJSON('/api/profile');
  const after = (list2.json || []).find(p => p.id === id);
  check('GET reflects PATCH (value updated, category cleared)',
        after?.value === 'smoke-value-2' && after?.category == null,
        `got ${JSON.stringify(after)}`);

  const del = await fetchJSON(`/api/profile/${id}`, { method: 'DELETE' });
  check('DELETE → ok', del.ok && del.json?.id === id, `got ${JSON.stringify(del.json)}`);

  const list3 = await fetchJSON('/api/profile');
  const remaining = (list3.json || []).filter(p => !beforeIds.has(p.id));
  check('GET no smoke item remains', remaining.length === 0,
        `leftover: ${JSON.stringify(remaining)}`);

  const bad = await fetchJSON('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'no label' }),
  });
  check('POST missing label → 400', bad.status === 400, `got ${bad.status}`);

  const nf = await fetchJSON('/api/profile/9999999', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'x' }),
  });
  check('PATCH non-existent → 404', nf.status === 404, `got ${nf.status}`);
}

// 9. /api/images round-trip — POST raw PNG bytes → {url}; GET that url → the
//    image bytes with an image/* content-type; GET a missing id → 404; POST a
//    non-image content-type → 400. Local dev uses a simulated R2 bucket.
console.log('\n  /api/images round-trip');
{
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
    'base64',
  );
  const up = await fetchJSON('/api/images', {
    method: 'POST',
    headers: { 'content-type': 'image/png' },
    body: PNG,
  });
  check('POST png → {url:/api/images/…}',
        up.ok && typeof up.json?.url === 'string' && up.json.url.startsWith('/api/images/'),
        `got ${up.status} ${JSON.stringify(up.json)}`);

  let getStatus = 0, getType = '';
  try {
    const r = await fetch(BASE + (up.json?.url || '/api/images/none'), { signal: AbortSignal.timeout(5000) });
    getStatus = r.status;
    getType = r.headers.get('content-type') || '';
    await r.arrayBuffer();
  } catch { /* leave defaults → check fails with status 0 */ }
  check('GET url → 200 image/png',
        getStatus === 200 && getType.startsWith('image/png'),
        `got ${getStatus} ${getType}`);

  const nf = await fetchOK('/api/images/does-not-exist', 404);
  check('GET missing id → 404', nf.ok, `got ${nf.status}`);

  const bad = await fetchJSON('/api/images', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'not an image',
  });
  check('POST text/plain → 400', bad.status === 400, `got ${bad.status}`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log('  failures:');
  for (const f of fails) console.log(`    • ${f}`);
  console.log('');
  process.exit(1);
}
