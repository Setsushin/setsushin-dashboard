// demo.js — guest demo mode. Loaded as a plain <script> early in index.html
// so it patches window.fetch before any widget makes a request.
//
// When active (?demo / ?demo=1, or a host with a `demo` label such as
// demo.example.com or foo-demo.example.com) every /api/* call is served from
// localStorage instead of the Pages Functions + D1: no auth, no backend. CRUD
// persists per-browser (each guest gets their own sandbox); read-only feeds
// (markets/calendar/feed/fx) return fresh dummy data. The app itself is
// untouched — same rendering as production, just a different source.
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const active = params.has('demo') || /(^|[.-])demo([.-]|$)/i.test(location.hostname);
  if (!active) return;

  window.__DEMO__ = true;

  const NS = 'demo:v1:';
  const load = (k, d) => { try { const r = localStorage.getItem(NS + k); return r ? JSON.parse(r) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch {} };
  const nowSec = () => Math.floor(Date.now() / 1000);
  const offsetISO = (h) => new Date(Date.now() + h * 3600e3).toISOString();

  // ── Seed (CRUD collections, persisted + editable) ────────────────────
  const SEED = {
    tasks: [
      { id: 1, text: 'Renew passport before it expires', description: 'Book the ward office slot online', tag: 'Personal', kind: 'personal', done: false, due_at: nowSec() + 6 * 86400, created_at: nowSec() },
      { id: 2, text: 'Ship Q2 dashboard refactor', description: null, tag: 'Work', kind: 'work', done: false, due_at: nowSec() + 2 * 86400, created_at: nowSec() },
      { id: 3, text: 'Pay rent', description: null, tag: 'Personal', kind: 'personal', done: true, due_at: null, created_at: nowSec() },
    ],
    assets: [
      { id: 1, layer: 'L1', sublayer: null, name: 'Bank — checking',  jpy_man: 120, exposure: 'jpy', account: 'MUFG',     sort_order: 0, updated_at: nowSec() },
      { id: 2, layer: 'L1', sublayer: null, name: 'Cash — USD',       jpy_man: 40,  exposure: 'usd', account: 'Wise',     sort_order: 1, updated_at: nowSec() },
      { id: 3, layer: 'L2', sublayer: null, name: 'JGB ladder',       jpy_man: 80,  exposure: 'jpy', account: 'Rakuten',  sort_order: 0, updated_at: nowSec() },
      { id: 4, layer: 'L3', sublayer: null, name: 'VT (taxable)',     jpy_man: 210, exposure: 'usd', account: 'IBKR',     sort_order: 0, updated_at: nowSec() },
      { id: 5, layer: 'L3', sublayer: null, name: 'Trading 商社',     jpy_man: 60,  exposure: 'mixed-50-50', account: 'SBI', sort_order: 1, updated_at: nowSec() },
      { id: 6, layer: 'L4', sublayer: null, name: 'eMAXIS Slim (NISA)', jpy_man: 150, exposure: 'usd', account: 'NISA',   sort_order: 0, updated_at: nowSec() },
    ],
    profile: [
      { id: 1, category: 'IDs',      label: 'Passport No.',  value: 'TX1234567 (sample)',     note: 'expires 2031-08', sort_order: 0, updated_at: nowSec() },
      { id: 2, category: 'IDs',      label: 'My Number',     value: '1234 5678 9012',          note: null,             sort_order: 1, updated_at: nowSec() },
      { id: 3, category: 'Health',   label: 'Glasses Rx',    value: 'L -2.25 / R -2.50\nPD 62', note: 'last exam 2025-03', sort_order: 0, updated_at: nowSec() },
      { id: 4, category: 'Health',   label: 'Blood type',    value: 'A+',                      note: null,             sort_order: 1, updated_at: nowSec() },
      { id: 5, category: 'Contacts', label: 'Company phone', value: '+81 3-1234-5678',         note: 'reception',      sort_order: 0, updated_at: nowSec() },
    ],
    bookmarks: [
      { id: 1, bucket: 'home',      name: 'Gmail',   url: 'https://mail.google.com', mark: 'G', color: '#c0584a', sort_order: 0 },
      { id: 2, bucket: 'home',      name: 'GitHub',  url: 'https://github.com',      mark: 'GH', color: '#6e7681', sort_order: 1 },
      { id: 3, bucket: 'home',      name: 'Cal',     url: 'https://calendar.google.com', mark: 'C', color: '#7da27c', sort_order: 2 },
      { id: 4, bucket: 'home_grid', name: 'News',    url: 'https://news.ycombinator.com', mark: 'Y', color: '#d4a574', sort_order: 0 },
      { id: 5, bucket: 'finance',   name: 'IBKR',    url: 'https://www.interactivebrokers.com', mark: 'IB', color: '#9caf88', sort_order: 0 },
      { id: 6, bucket: 'finance',   name: 'TradingView', url: 'https://www.tradingview.com', mark: 'TV', color: '#c97c5d', sort_order: 1 },
      { id: 7, bucket: 'feed',      name: 'Lobsters', url: 'https://lobste.rs',     mark: 'L', color: '#a8967b', sort_order: 0 },
    ],
    journal: [
      { id: 1, title: 'Welcome to the demo', body: 'This dashboard is running in **demo mode**.\n\n- Everything you see is dummy data.\n- You can add, edit, drag and delete — changes are saved **only in this browser**.\n- Nothing is sent to a server.\n\nHit *Reset demo* (bottom-right) to wipe your changes.', tags: ['meta'], created_at: nowSec(), updated_at: nowSec() },
    ],
    layout: {},
    pages: [],
  };

  if (!load('seeded', false)) {
    for (const k of Object.keys(SEED)) save(k, SEED[k]);
    save('seeded', true);
  }

  const getCol = (k) => load(k, []);
  const nextId = (arr) => arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  const nextSort = (arr) => arr.reduce((m, x) => Math.max(m, (x.sort_order || 0) + 1), 0);

  // ── Read-only feeds (fresh dummy each call, not stored) ──────────────
  const MARKETS = [
    { symbol: 'SPY',     price: 569.45,   previousClose: 567.83,   changePercent:  0.29, currency: 'USD' },
    { symbol: 'BTC-USD', price: 87432.10, previousClose: 86120.55, changePercent:  1.52, currency: 'USD' },
    { symbol: 'JPY=X',   price: 156.42,   previousClose: 156.83,   changePercent: -0.26, currency: 'JPY' },
    { symbol: '^TNX',    price: 4.234,    previousClose: 4.198,    changePercent:  0.86, currency: '%'   },
    { symbol: '^N225',   price: 38924.55, previousClose: 38712.10, changePercent:  0.55, currency: 'JPY' },
  ];
  const feed = () => [
    { source: 'Hacker News', title: 'Show HN: I built a no-build dashboard',      link: 'https://news.ycombinator.com', published: offsetISO(-0.5), kind: 'rss' },
    { source: 'Hacker News', title: 'The case for boring technology',             link: 'https://news.ycombinator.com', published: offsetISO(-3),   kind: 'rss' },
    { source: 'Fireship',    title: 'Cloudflare D1 in 100 seconds',               link: 'https://youtube.com',          published: offsetISO(-5),   kind: 'youtube' },
    { source: 'Lobsters',    title: 'On Worker isolates and cold starts',         link: 'https://lobste.rs',            published: offsetISO(-8),   kind: 'rss' },
    { source: 'Lobsters',    title: 'SQLite at the edge: lessons learned',        link: 'https://lobste.rs',            published: offsetISO(-14),  kind: 'rss' },
    { source: 'ThePrimeTime', title: 'I tried building without a bundler',        link: 'https://youtube.com',          published: offsetISO(-20),  kind: 'youtube' },
  ];
  const calendar = () => [
    { title: 'Design Review', start: offsetISO(1.5), location: 'Zoom',    allDay: false },
    { title: 'Project Sync',  start: offsetISO(4.0), location: 'Office',  allDay: false },
    { title: 'Deep Work',     start: offsetISO(6.5), location: '',        allDay: false },
    { title: 'Gym',           start: offsetISO(9.0), location: 'Anytime', allDay: false },
    { title: 'Dentist',       start: offsetISO(26),  location: 'Shibuya', allDay: false },
  ];

  // ── Router ───────────────────────────────────────────────────────────
  const ok = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

  const COLS = ['tasks', 'assets', 'profile', 'bookmarks', 'journal'];

  function build(col, body) {
    const arr = getCol(col);
    const base = { ...body, id: nextId(arr) };
    if (col === 'tasks')   return { description: null, tag: null, kind: null, due_at: null, ...base, done: !!body.done, created_at: nowSec() };
    if (col === 'journal') return { title: null, body: '', ...base, tags: Array.isArray(body.tags) ? body.tags : [], created_at: nowSec(), updated_at: nowSec() };
    // assets / profile / bookmarks: append to the end of their group
    return { sort_order: nextSort(arr), ...base, updated_at: nowSec() };
  }

  function sortCol(col, arr) {
    const a = arr.slice();
    if (col === 'tasks')   a.sort((x, y) => (x.done === y.done ? x.id - y.id : (x.done ? 1 : 0) - (y.done ? 1 : 0)));
    if (col === 'assets')  a.sort((x, y) => x.layer.localeCompare(y.layer) || x.sort_order - y.sort_order || x.id - y.id);
    if (col === 'profile') a.sort((x, y) => String(x.category).localeCompare(String(y.category)) || x.sort_order - y.sort_order || x.id - y.id);
    if (col === 'journal') a.sort((x, y) => y.created_at - x.created_at || y.id - x.id);
    if (col === 'bookmarks') a.sort((x, y) => x.sort_order - y.sort_order || x.id - y.id);
    return a;
  }

  function handle(method, url, body) {
    const u = new URL(url, location.origin);
    const path = u.pathname;

    if (path === '/api/me') return ok({ email: 'guest@demo', local: false });
    if (path === '/api/fx') return ok({ rates: { USD: 0.0064, CNY: 0.046 }, stale: false, source: 'demo' });
    if (path === '/api/markets') return ok(MARKETS);
    if (path === '/api/feed') return ok(feed());
    if (path === '/api/calendar/sources') return ok([{ key: 'primary', label: 'Primary' }]);
    if (path === '/api/calendar') return ok(calendar());

    if (path === '/api/layout') {
      const map = load('layout', {});
      if (method === 'GET') return ok(map);
      if (method === 'PUT') { if (body && body.page_id) { map[body.page_id] = body.grid; save('layout', map); } return ok({ ok: true }); }
      if (method === 'DELETE') { const pid = u.searchParams.get('page_id'); if (pid) { delete map[pid]; save('layout', map); return ok({ deleted: pid }); } save('layout', {}); return ok({ deleted: 'all' }); }
    }
    if (path === '/api/pages') return ok(load('pages', []));
    const pageM = path.match(/^\/api\/pages\/(.+)$/);
    if (pageM) {
      const pages = load('pages', []);
      const id = decodeURIComponent(pageM[1]);
      if (method === 'PUT')    { const i = pages.findIndex(p => p.page_id === id); const row = { page_id: id, sort_order: 100, ...body }; if (i >= 0) pages[i] = { ...pages[i], ...row }; else pages.push(row); save('pages', pages); return ok({ ok: true, page_id: id }); }
      if (method === 'DELETE') { save('pages', pages.filter(p => p.page_id !== id)); return ok({ ok: true, page_id: id }); }
    }

    // Collections: /api/<col> (GET list, POST create) · /api/<col>/<id> (PATCH, DELETE)
    const m = path.match(/^\/api\/([a-z]+)(?:\/(\d+))?$/);
    if (m && COLS.includes(m[1])) {
      const col = m[1];
      const id = m[2] ? parseInt(m[2], 10) : null;
      let arr = getCol(col);

      if (id == null) {
        if (method === 'GET') {
          if (col === 'bookmarks') {
            const bucket = u.searchParams.get('bucket');
            if (bucket) arr = arr.filter(x => x.bucket === bucket);
          }
          return ok(sortCol(col, arr));
        }
        if (method === 'POST') {
          if ((col === 'tasks' && !String(body.text || '').trim()) ||
              (col === 'profile' && !String(body.label || '').trim()) ||
              (col === 'journal' && !String(body.body || '').trim()) ||
              (col === 'bookmarks' && (!body.bucket || !body.name || !body.url))) {
            return ok({ error: 'invalid' }, 400);
          }
          const row = build(col, body);
          arr.push(row); save(col, arr);
          return ok(row);
        }
      } else {
        const i = arr.findIndex(x => x.id === id);
        if (i < 0) return ok({ error: 'not found' }, 404);
        if (method === 'PATCH')  { arr[i] = { ...arr[i], ...body, id, updated_at: nowSec() }; save(col, arr); return ok({ ok: true, id }); }
        if (method === 'DELETE') { arr.splice(i, 1); save(col, arr); return ok({ ok: true, id }); }
      }
    }

    return ok({ error: 'demo: unhandled ' + method + ' ' + path }, 404);
  }

  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url);
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (url && /\/api\//.test(url)) {
      let body = null;
      const raw = init && init.body;
      if (raw) { try { body = JSON.parse(raw); } catch {} }
      try { return Promise.resolve(handle(method, url, body || {})); }
      catch (e) { return Promise.resolve(ok({ error: String(e) }, 500)); }
    }
    return _fetch(input, init);
  };

  // ── Banner ───────────────────────────────────────────────────────────
  function banner() {
    if (document.getElementById('demo-banner')) return;
    const el = document.createElement('div');
    el.id = 'demo-banner';
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;align-items:center;gap:10px;' +
      'padding:7px 12px;border-radius:999px;background:rgba(30,28,26,.88);color:#f3ede2;' +
      'font:500 12px/1 system-ui,-apple-system,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);backdrop-filter:blur(6px);';
    const txt = document.createElement('span');
    txt.textContent = 'Demo · data lives only in this browser';
    const btn = document.createElement('button');
    btn.textContent = 'Reset';
    btn.style.cssText = 'border:none;cursor:pointer;border-radius:999px;padding:4px 10px;' +
      'background:#c97c5d;color:#fff;font:600 12px system-ui,sans-serif;';
    btn.onclick = () => {
      Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k));
      location.reload();
    };
    el.append(txt, btn);
    document.body.appendChild(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
  else banner();
})();
