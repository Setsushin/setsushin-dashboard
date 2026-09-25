# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal dashboard. React 18 + **TypeScript** SPA bundled with **Vite**,
deployed to Cloudflare Pages with Pages Functions handling the backend
(markets, calendar, RSS+YouTube feed, FX, tasks, assets, bookmarks, journal,
profile, training). Pages are plain React components under `src/pages/`;
there is no runtime layout config and no in-app layout editor. Single-user,
gated by Cloudflare Access in production. D1 backs per-user state.

> **History:** the original implementation was [Glance](https://github.com/glanceapp/glance)
> on a JP VPS behind a Cloudflare Tunnel (recoverable from `master` history).
> A later iteration ran React via CDN babel-standalone with **no build step**,
> then a `layout.yml`-driven widget registry with a drag editor and per-user
> D1 layout overrides. Both are gone: don't reintroduce CDN `<script>` widgets,
> `window.*` cross-file globals, or a runtime widget registry.

## Local dev loop

```sh
npm install
npm run dev                       # vite dev server → http://127.0.0.1:8787
npm run dev:cf                    # wrangler pages dev → Functions + D1 on :8788
npm test                          # vitest — parseFeed + parseICS + parseAmount units
npm run typecheck                 # tsc, app (tsconfig.json) + functions (tsconfig.functions.json)
npm run build                     # tsc + vite build → dist/
npm run smoke                     # scripts/smoke.mjs against a running dev server
npm run db:migrate:local          # apply migrations/*.sql to local SQLite
node scripts/seed-assets.mjs      # seed portfolio rows from ~/setsushin-llm-pa/profile/assets.md
```

Full-stack local dev = run **both** `npm run dev` (UI with HMR) and
`npm run dev:cf` (Functions + D1). Vite proxies `/api/*` → `127.0.0.1:8788`
(see `vite.config.ts`). Run a single test file with
`npx vitest run test/parseICS.test.ts`.

Prod migrations: `npm run db:migrate:remote` (requires `npm run login` first).

## File layout

**`src/`** is the bundled application (TypeScript, compiled by Vite).
**`public/`** is Vite's static dir — copied verbatim into `dist/` and served
at the site root (icons, `training.yml`). **`functions/`** are CF Pages
Functions (TypeScript, compiled by Pages). `dist/` is the build output that
Pages serves.

```
index.html                    ← Vite entry; loads /src/main.tsx
src/
├── main.tsx                  # entry: installs demo mode, imports global CSS, renders <App/>
├── App.tsx                   # shell (sidebar, topbar, page header) around the routed page
├── types.ts                  # shared domain types (D1 rows + API responses)
├── demo.ts                   # guest demo mode (patches window.fetch → localStorage)
├── pages/
│   ├── index.ts              # PAGES registry: id, label, icon, title, subtitle, Component
│   └── home.tsx · finance.tsx · feed.tsx · journal.tsx · training.tsx · profile.tsx
├── components/
│   ├── Panel.tsx             # card shell; size (large|wide|full) + rows → grid footprint
│   ├── Heatmap.tsx           # 365d/90d/30d day heatmap (training + journal History)
│   ├── Sidebar · TopBar · UserMenu · PageHeader · Toast · tweaks   # shell
│   ├── <name>.tsx + <name>.css   # one per feature: tasks, calendar, markets,
│   │                             #   bookmarks, feed, assets, journal, profile, training
│   ├── TaskFormModal.tsx · bookmarks-edit.tsx · icons.tsx · mockHint.ts
│   └── tasks-utils.ts · assets-utils.ts · journal-images.ts
├── hooks/  useFetch.ts · useHashRoute.ts · useTasksList.ts · useTweaks.ts
├── lib/    api.ts · color.ts · markdown.ts · events.ts
└── styles/ tokens.css · styles.css (shell, grid, kits, responsive)

public/                       ← copied verbatim to dist/ (served at /)
├── icons/  training.yml

functions/                    ← CF Pages Functions (TypeScript)
├── _lib/  auth.ts · types.ts · schemas.ts · parse.ts · http.ts · journal-tags.ts
└── api/   markets.ts feed.ts calendar.ts fx.ts me.ts images.ts
          assets.ts asset-snapshots.ts tasks.ts bookmarks.ts profile.ts journal.ts training.ts
          <name>/[id].ts (PATCH/DELETE) · calendar/sources.ts

migrations/   D1 schema                 test/   vitest units (.test.ts)
scripts/      dev-only tooling (.mjs)   tsconfig*.json · vite.config.ts
```

`pages_build_output_dir = "dist"` (wrangler.toml). Vite bundles `src/` into
content-hashed assets; only `dist/` + `functions/` reach the edge. Smoke test
#3 verifies the fence by GETting `src/`, `functions/*.ts`, `package.json`, etc.
and asserting 404 / SPA fallback.

## Adding a page — two places

1. Write `src/pages/<id>.tsx` exporting a component that composes existing
   components inside `<div className="grid">` (and optionally a
   `<div className="header-strip">` above it).
2. Add an entry to `PAGES` in `src/pages/index.ts` (`id` is the hash route
   and sidebar order is array order).

A new feature component is `src/components/<name>.tsx` + co-located
`<name>.css`, rendering inside `<Panel title=… hint=… action=… size=…>`.

## Non-obvious invariants

1. **Real ES modules — no `window.*` globals, no registry.** Pages import the
   components they use. Cross-file references are normal `import`s.
2. **`useFetch` returns mock fallback on any error.** Each data component
   renders `mockHint({error, allErrored, reason})` in the Panel header so
   degraded data is visible as `(mock — reason)`. The markets pattern is
   "200 OK with all entries having an `error` field" — the component checks
   that and passes `allErrored: true`.
3. **Grid placement is CSS, not code.** `.grid` is 3 columns × `--row-h` rows
   with `grid-auto-flow: row dense`. `Panel` writes `data-size`
   (`large` 1×2, `wide` 2×2, `full` = every column) and an optional inline
   `grid-row: span N` from `rows`. Source order in the page component is the
   placement order. Mobile (≤768px) resets rows to `auto`.
4. **D1 binding name is `env.setsushin_dash`** (underscore). The `Env` interface
   lives in `functions/_lib/types.ts`; handlers are typed `PagesFunction<Env>`
   (and `PagesFunction<Env, 'id'>` for dynamic routes).
5. **Tone + mode are body data attrs.** `App.tsx` writes `data-tone`,
   `data-density`, `data-sidebar`, `data-radius`, `data-mode` on `<body>`, and
   `tokens.css` swaps CSS variables off those selectors. `--accent` is set inline;
   `--accent-soft` is a `color-mix` of accent over `--bg-card`, declared on
   `body` so it follows tone and dark mode.
6. **Shared style kits live in `styles.css`; component CSS only adds modifiers.**
   `.field` (inputs), `.chip` (+ `is-outline` / `is-active`), `.section-head`,
   `.label-mono`, `.seg`/`.seg-btn` (+ `seg-fill`), `.fold`/`.fold-body`, `.panel-action` with
   `.btn-primary` / `.btn-danger`, `.empty`, `.muted`. No hex colors or font
   stacks outside `tokens.css` — the two exceptions are the assets chart
   palette and bookmark swatches, which are data, not chrome. Display type is
   the serif italic (`--font-display`, weight 500): page H1, journal titles,
   training day names, the avatar and brand mark.
7. **Request bodies in Functions are untrusted at the boundary** — validate +
   coerce with zod (`functions/_lib/schemas.ts` through `parse.ts`, errors via
   `http.ts`). Component props are plain typed TypeScript.

## Data layer (D1)

| API | Table | Per-user | Notes |
|---|---|---|---|
| `/api/tasks`     | `tasks`            | yes | GET list · POST · `tasks/[id]` PATCH/DELETE |
| `/api/assets`    | `assets`           | yes | GET list · POST · `assets/[id]` PATCH/DELETE |
| `/api/asset-snapshots` | `asset_snapshots` | yes | GET `?days=N` · POST (server self-reads assets; same JST day overwrites) |
| `/api/bookmarks` | `bookmarks_local`  | yes | GET (by bucket) · POST · `bookmarks/[id]` PATCH/DELETE |
| `/api/journal`   | `journal_entries`  | yes | GET list · POST · `journal/[id]` PATCH/DELETE |
| `/api/profile`   | `profile_items`    | yes | GET list · POST · `profile/[id]` PATCH/DELETE |
| `/api/training`  | `training_state`   | yes | GET fold `{key: doc}` · PUT one key (`weights` / `log:YYYY-MM-DD`) |

User identity comes from `getUserEmail(request, env)` in
`functions/_lib/auth.ts`: prod reads the `Cf-Access-Authenticated-User-Email`
header or decodes `Cf-Access-Jwt-Assertion` (CF Access verifies upstream);
local dev falls back to `LOCAL_DEV_USER_EMAIL` or `local@dev`. Functions never
trust client-provided identity.

Tasks mutations dispatch a typed `tasks-updated` window event
(`src/lib/events.ts`); `useTasksList` listens so every Tasks panel on the page
updates live.

`components/assets.tsx` is full-width (`size="full" rows={3}`). Sunburst +
list + currency toggle (JPY/USD/CNY, JPY default). FX from `/api/fx`
(Frankfurter ECB, 1h cache, hardcoded fallback on error).
`scripts/seed-assets.mjs` parses `### L<N>` sections from
`~/setsushin-llm-pa/profile/assets.md` and POSTs to `/api/assets`.

Bookmarks are keyed by `bucket`; each page's header strip uses its page id
(`home`, `finance`, `feed`). D1 still holds `home_grid` / `feed_grid` rows
from the old in-grid panels; nothing renders them.

## Read-only data fetching

Pages Function at `functions/api/<name>.ts` proxies a public API. Components
call their `/api/<name>` endpoint directly. `useFetch` adds a 5–10min
`sessionStorage` TTL cache; the Function adds `Cache-Control: max-age=600` so
CF edge caches too.

## Local dev caveats

- Yahoo Finance often 403s from residential/proxied IPs; markets falls back to
  mock with the visible "(mock — upstream blocked)" indicator. Works from CF edge.
- YouTube Atom can hang on local egress; per-source `AbortSignal.timeout(8000)`
  in `functions/api/feed.ts` keeps one slow source from holding the response.
- `npm run smoke` tolerates `/api/feed` and `/api/calendar` 4xx (function ran but
  upstream unreachable) — only 5xx / timeout fail smoke.
- `/api/fx` always returns 200 (hardcoded fallback on upstream error).

## Secret URLs (Calendar ICS, future API tokens)

Live in CF Pages env vars, named `CALENDAR_<KEY>_ICS` (uppercased, `_ICS`
suffix). For local dev set in `wrangler.toml [vars]`. For prod: CF Pages
dashboard → Settings → Environment variables. Never commit secret URLs.

## Smoke check

`npm run smoke` (against a running dev server) verifies: (1) the SPA shell +
runtime-fetched files (`/`, `/training.yml`, icons) load and index.html ships
a bundled module script; (2) every Function is reachable; (3) source outside
`dist/` is fenced off (404 / SPA fallback); (4) full CRUD round-trips for
tasks/bookmarks/assets/profile/images/training plus 400/404 cases.

Checks (1) and (3) only hold against `wrangler pages dev` serving a fresh
`dist/` — run `npm run build && SMOKE_URL=http://127.0.0.1:8788 npm run smoke`.
Against the Vite dev server those two sections fail by design.

Run after every feature commit. Exits 1 on first red. Override base URL with
`SMOKE_URL=…`.
