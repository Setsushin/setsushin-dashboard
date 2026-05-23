# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal dashboard. React 18 SPA via CDN babel-standalone (no build step),
deployed to Cloudflare Pages with Pages Functions handling backend (markets,
calendar, RSS+YouTube feed, FX, tasks, assets, layout). Layout-config-driven
via `layout.yml`. Single-user, gated by Cloudflare Access in production. D1
backs per-user state (tasks, assets, layout overrides).

> **History:** the original implementation was [Glance](https://github.com/glanceapp/glance)
> running on a JP VPS behind a Cloudflare Tunnel. That version still lives on
> the `master` branch history and was on the VPS at `/opt/setsushin-dashboard`.
> Don't restore Glance files into this branch — they're recoverable from git
> history if ever needed (`git show <old-sha>:glance.yml`).

## Local dev loop

```sh
npm test                          # node --test, parseFeed + parseICS units
npm run dev                       # wrangler pages dev → http://127.0.0.1:8787
npm run smoke                     # scripts/smoke.mjs against the dev server
npm run db:migrate:local          # apply migrations/*.sql to local SQLite
node scripts/seed-assets.mjs      # seed portfolio rows from ~/setsushin-llm-pa/profile/assets.md
```

`wrangler pages dev` serves `public/` + auto-discovers Pages Functions
under `functions/`. Run a single test file with
`node --test test/parseICS.test.mjs`.

Prod migrations: `npm run db:migrate:remote` (requires `npm run login` first).

## File layout

Two halves: **`public/`** is the static asset root that CF Pages serves;
everything else at repo root is configs, Functions (deployed as workers,
not assets), or dev-only tooling that stays off the edge.

```
public/                       ← deployed to CF Pages as static asset root
├── index.html                # script load order matters — see invariants
├── tokens.css                # design tokens (vars, tone/mode/density variants)
├── styles.css                # shell styling: sidebar, topbar, grid, panel, edit
├── core.jsx                  # PRIMITIVES: useFetch / useLayout / useHashRoute /
│                             #   useTasksList / Panel / WIDGETS registry /
│                             #   normalizeItem / useWidgetSize / mockHint
├── shell.jsx                 # CHROME: Sidebar / TopBar / PageHeader /
│                             #   HeaderStrip / Stat / StatStrip / DashboardGrid
├── edit-mode.jsx             # EditableGrid / EditPanel / AddWidgetPicker
├── app.jsx                   # <App/> — composes shell + grid + tweaks panel
├── boot.jsx                  # ReactDOM.createRoot(...).render(<App/>) — runs LAST
├── tweaks-panel.jsx          # design-time tweak controls (theme, density, name)
├── layout.yml                # nav + pages + per-page stats/header/grid
├── schedule.yml              # static agenda items (used by widgets/agenda.jsx)
├── icons/
└── widgets/
    ├── <type>.jsx            # one file per type, ends with registerWidget(...)
    └── <type>.css            # co-located widget styles (loaded via index.html)

functions/                    ← CF Pages Functions (workers, not static assets)
├── _lib/auth.js              # getUserEmail + json() helper
└── api/
    ├── markets.js  feed.js  calendar.js  fx.js  layout.js
    ├── assets.js   assets/[id].js     # GET/POST list, PATCH/DELETE single
    └── tasks.js    tasks/[id].js      # same pattern

migrations/                   ← D1 schema (dev-only, never deployed)
├── 0001_init.sql             # layout_overrides + tasks
└── 0002_assets.sql           # assets

scripts/                      ← dev-only tooling
├── smoke.mjs                 # post-feature verification
└── seed-assets.mjs           # one-shot portfolio seed from external markdown

test/                         ← node --test units (dev-only)
wrangler.toml                 # pages_build_output_dir = "public"
```

`pages_build_output_dir = "public"` is what fences `migrations/`, `test/`,
`scripts/`, `package.json`, and `wrangler.toml` off the edge — wrangler
dev/deploy uploads only what's under `public/` plus `functions/` (which
CF discovers automatically at the project root). Smoke test #3 verifies
this fence by trying to GET those paths and asserting 404 / SPA fallback.

## Adding a widget type — three places

1. Write `widgets/<type>.jsx` ending with `registerWidget('<type>', Component)`.
   Use `<Panel title=… hint=… action=…>` shell. If you need styles, add
   `widgets/<type>.css`.
2. Add `<script type="text/babel" src="widgets/<type>.jsx"></script>` to
   `index.html` (after `shell.jsx`, before `edit-mode.jsx`/`app.jsx`/`boot.jsx`).
   If you added a CSS file, add a `<link>` for it too.
3. Reference in `layout.yml` grid: `- type: <type>` with optional `config:`,
   `size:` (`large` default | `compact`).

## Non-obvious invariants

1. **Script order matters in `index.html`.** Babel-standalone parses each
   `<script type="text/babel">` as a separate top-level scope, but function
   declarations are hoisted to global. Order:
   `tweaks-panel → core → shell → widgets/* → edit-mode → app → boot`.
   `core.jsx` defines `registerWidget` and `Panel`; `shell.jsx` and the
   widgets depend on those; `app.jsx` composes everything; `boot.jsx`
   renders last so all components are registered by then.
2. **Cross-file references go through `window`.** No module system —
   `window.WIDGETS`, `window.Panel`, `window.WidgetContext`,
   `window.useWidgetSize`, `window.mockHint`, `window.normalizeItem` are
   the public API. Function declarations at file top level become global
   automatically (`useFetch`, `useLayout`, `Sidebar`, etc.) so they work
   from sibling scripts without explicit `window.` assignment.
3. **`useFetch` returns mock fallback on any error.** Each widget renders
   `mockHint({error, allErrored, reason})` in the Panel header so degraded
   data is always visible as `(mock — reason)`. The markets pattern is
   "200 OK with all entries having an `error` field" — widgets check that
   themselves and pass `allErrored: true` to `mockHint`.
4. **`layout.yml` per-page schema:**
   - `id` ↔ `nav.id` — sidebar item routes to this page via
     `window.location.hash`.
   - `title` (optional) — replaces the greeting in `PageHeader`; `subtitle`
     shows below it.
   - `stats[]` — top-of-page numeric tiles; `Stat` dispatches on `type`
     (`tasksRemaining` | `feedCount` | `count` | omitted for static).
   - `header[]` — full-width strip above the grid (`HeaderStrip`); each
     item is a normal widget that opts into strip mode via
     `config.layout === 'row'` (only `bookmarks` does this today).
   - `grid[]` — main panel grid. Each item has `type` + optional `size`
     (`large` = 1 col × 2 rows, default; `compact` = 1 col × 1 row) and
     optional `config`. The grid uses `grid-auto-flow: dense` so smaller
     items backfill earlier holes. Variety comes from arrangement, not
     size variation.
5. **Per-page layout overrides live in D1.** `layout.yml` is the
   structural template. The pencil button in `TopBar` opens
   `EditableGrid` (drag-reorder, size toggle, add/remove); Save PUTs to
   `/api/layout`, Reset DELETEs. `useLayout` in `core.jsx` merges yaml +
   overrides per page; `setOverrideLocal` does optimistic updates so the
   dashboard rerenders instantly on Save. Switching pages while editing
   drops the unsaved draft (intentional — see comment in `app.jsx`).
6. **D1 binding name is `env.setsushin_dash`** (underscore, not `env.DB`).
   Functions read `env.setsushin_dash` directly. Variable name in
   `wrangler.toml` matches.
7. **Tone + mode are body data attrs.** `app.jsx` writes `data-tone`,
   `data-density`, `data-sidebar`, `data-radius`, `data-mode` on
   `<body>`, and `tokens.css` swaps CSS variables off those selectors.
   Custom accent: `--accent` is set inline; `--accent-soft` is derived
   live by mixing accent → cream at 28% (`hexToSoft` in `app.jsx`) so
   user-picked colors stay readable on warm backgrounds.

## Data layer (D1)

| API | Table | Per-user | Notes |
|---|---|---|---|
| `/api/layout`  | `layout_overrides` | yes | GET map · PUT one · DELETE one or all |
| `/api/tasks`   | `tasks`            | yes | GET list · POST · `tasks/[id]` PATCH/DELETE |
| `/api/assets`  | `assets`           | yes | GET list · POST · `assets/[id]` PATCH/DELETE |

User identity comes from `getUserEmail(request, env)` in
`functions/_lib/auth.js`: prod reads the
`Cf-Access-Authenticated-User-Email` header (CF Access verifies upstream);
local dev falls back to `LOCAL_DEV_USER_EMAIL` from `wrangler.toml [vars]`
or `local@dev`. Functions never trust client-provided identity.

`widgets/tasks.jsx` dispatches a `tasks-updated` window event on every
mutation; `useTasksList` in `core.jsx` listens so the StatStrip counter
updates live without rerendering App. One-time migration on first task
widget mount: if D1 is empty for the current user AND `localStorage.tasks`
has items, POST each then clear localStorage.

`widgets/assets.jsx` is full-width via `<Panel className="panel-wide">`
which CSS-spans columns 1 / -1. Sunburst + list + currency toggle
(JPY/USD/CNY) + view toggle (By Layer / By Currency). FX rates from
`/api/fx` (Frankfurter ECB, 1h cache, hardcoded fallback on error).

`scripts/seed-assets.mjs` parses `### L<N>` sections from
`~/setsushin-llm-pa/profile/assets.md` and POSTs to `/api/assets`.
Idempotent: aborts if rows exist; pass `--force` to wipe + re-seed.

## Read-only data fetching

Pages Function at `functions/api/<name>.js` proxies a public API and adds
CORS-free same-origin access. Widget config in `layout.yml` carries
`endpoint: /api/<name>` plus per-widget params. `useFetch` adds 5–10min
`sessionStorage` TTL cache; the Function adds `Cache-Control: max-age=600`
so CF edge caches too. Three layers of cache → real upstream hits are rare.

## Local dev caveats

- Yahoo Finance often 403s from this Mac's network (proxy via CN exits
  Yahoo blocks); markets widget falls back to mock with the visible
  "(mock — upstream blocked)" indicator. Same path works from CF edge IPs.
- YouTube Atom can hang on local egress; per-source `AbortSignal.timeout(8000)`
  in `functions/api/feed.js` keeps one slow source from holding the response.
- `npm run smoke` tolerates `/api/feed` and `/api/calendar` to 4xx (function
  ran but upstream was unreachable) — only 5xx / timeout fail smoke.
- `/api/fx` always returns 200 (uses hardcoded fallback on upstream error).

## Secret URLs (Calendar ICS, future API tokens)

Live in CF Pages env vars, named `CALENDAR_<KEY>_ICS` (uppercased, `_ICS`
suffix). For local dev set in `wrangler.toml [vars]` (commented examples
in the file). For prod: CF Pages dashboard → Settings → Environment
variables. Never put secret URLs in `layout.yml` or commit them.

## Smoke check

`npm run smoke` (against `wrangler dev`) verifies:
1. Every entry-point static asset returns 200 (jsx, css, layout.yml, icons).
2. Every Function is reachable (`/api/layout`, `/api/fx`, `/api/feed`,
   `/api/calendar`).
3. Source code outside `public/` is fenced off (404 / SPA fallback).
4. `/api/layout`, `/api/tasks`, `/api/assets` full CRUD round-trips
   (POST → GET → PATCH → GET → DELETE → GET) plus 400/404 negative cases.

Run after every feature commit. ~2s, exits 1 on first red. Override base
URL with `SMOKE_URL=…`.
