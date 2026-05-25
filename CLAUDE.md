# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal dashboard. React 18 + **TypeScript** SPA bundled with **Vite**,
deployed to Cloudflare Pages with Pages Functions handling the backend
(markets, calendar, RSS+YouTube feed, FX, tasks, assets, bookmarks, journal,
profile, pages, layout). Layout-config-driven via `layout.yml`. Single-user,
gated by Cloudflare Access in production. D1 backs per-user state.

> **History:** the original implementation was [Glance](https://github.com/glanceapp/glance)
> on a JP VPS behind a Cloudflare Tunnel (recoverable from `master` history).
> A later iteration ran React via CDN babel-standalone with **no build step**;
> that has since been migrated to the Vite + TypeScript setup documented here.
> Don't reintroduce CDN `<script>` widgets or `window.*` cross-file globals.

## Local dev loop

```sh
npm install
npm run dev                       # vite dev server → http://127.0.0.1:8787
npm run dev:cf                    # wrangler pages dev → Functions + D1 on :8788
npm test                          # vitest — parseFeed + parseICS units
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
at the site root (icons, runtime-fetched yaml). **`functions/`** are CF Pages
Functions (TypeScript, compiled by Pages). `dist/` is the build output that
Pages serves.

```
index.html                    ← Vite entry; loads /src/main.tsx
src/
├── main.tsx                  # entry: installs demo mode, imports global CSS, renders <App/>
├── App.tsx                   # root composition (page CRUD, tweak host protocol, modals)
├── types.ts                  # shared domain + layout types
├── demo.ts                   # guest demo mode (patches window.fetch → localStorage)
├── vite-env.d.ts
├── lib/
│   ├── grid.ts               # placeItems / resolveCollisions / itemFootprint / GRID_COLS
│   ├── color.ts              # hexToSoft / tint
│   ├── markdown.ts           # renderMarkdown (marked + DOMPurify)
│   └── events.ts             # typed window CustomEvent bus (tasks-updated, task modal)
├── hooks/
│   ├── useFetch.ts           # TTL sessionStorage cache + fallback
│   ├── useLayout.ts          # layout.yml + /api/layout + /api/pages, merged per page
│   ├── useHashRoute.ts · useTasksList.ts · useTweaks.ts
├── widgets/
│   ├── registry.tsx          # WIDGETS map, registerWidget, WidgetContext, useWidgetSize
│   ├── Panel.tsx · icons.tsx · mockHint.ts
│   ├── index.ts              # barrel: imports every widget for side-effect registration
│   ├── <type>.tsx + <type>.css   # one per type, ends with registerWidget('<type>', …)
│   ├── tasks-utils.ts · TaskFormModal.tsx · bookmarks-edit.tsx
├── components/               # shell: Sidebar, TopBar, UserMenu, PageHeader,
│   │                         #   HeaderStrip, Stat, DashboardGrid, PageMetaModal
│   └── tweaks.tsx            # TweaksPanel + controls
├── edit/                     # EditableGrid, EditPanel, AddWidgetPicker
└── styles/                   # tokens.css, styles.css, edit-mode.css (global)

public/                       ← copied verbatim to dist/ (served at /)
├── icons/  layout.yml  schedule.yml

functions/                    ← CF Pages Functions (TypeScript)
├── _lib/  auth.ts · types.ts · coerce.ts · patch.ts · journal-tags.ts
└── api/   markets.ts feed.ts calendar.ts fx.ts me.ts layout.ts pages.ts
          assets.ts tasks.ts bookmarks.ts profile.ts journal.ts
          <name>/[id].ts (PATCH/DELETE) · calendar/sources.ts · pages/[id].ts

migrations/   D1 schema (dev-only)        test/   vitest units (.test.ts)
scripts/      dev-only tooling (.mjs)     tsconfig*.json · vite.config.ts
```

`pages_build_output_dir = "dist"` (wrangler.toml). Vite bundles `src/` into
content-hashed assets; only `dist/` + `functions/` reach the edge. Smoke test
#3 verifies the fence by GETting `src/`, `functions/*.ts`, `package.json`, etc.
and asserting 404 / SPA fallback.

## Adding a widget type — three places

1. Write `src/widgets/<type>.tsx` ending with `registerWidget('<type>', Component)`.
   Use the `<Panel title=… hint=… action=…>` shell. Co-locate `<type>.css` and
   `import './<type>.css'` from the widget.
2. Add `import './<type>';` to `src/widgets/index.ts` so it registers at load.
3. Reference it in a `layout.yml` grid: `- type: <type>` with optional `config:`,
   `size:` (`large` default | `compact`).

## Non-obvious invariants

1. **Real ES modules — no `window.*` globals, no script order.** Cross-file
   references are normal `import`s. The widget registry (`src/widgets/registry.tsx`)
   is the public surface for widgets: `registerWidget`, `getWidget`, `WidgetContext`,
   `useWidgetSize`. `src/widgets/index.ts` must import every widget module so
   registration side effects run before `<App/>` renders (`main.tsx` imports it).
2. **`useFetch` returns mock fallback on any error.** Each widget renders
   `mockHint({error, allErrored, reason})` in the Panel header so degraded data
   is visible as `(mock — reason)`. The markets pattern is "200 OK with all
   entries having an `error` field" — widgets check that and pass `allErrored: true`.
3. **`layout.yml` per-page schema:** `id` ↔ `nav.id`; optional `title`/`subtitle`;
   `stats[]` (top tiles, `Stat` dispatches on `type`); `header[]` (full-width strip,
   widget opts in via `config.layout === 'row'`); `grid[]` (`type` + optional `size`
   + `config`). The grid is free-form 3-col: each item resolves to `{col,row,w,h}`
   via `placeItems` (`src/lib/grid.ts`); items without positions are flow-placed.
4. **Per-page layout overrides live in D1.** `layout.yml` is the template. The
   pencil in `TopBar` opens `EditableGrid` (drag-reorder, resize, add/remove);
   Save PUTs to `/api/layout`, Reset DELETEs. `useLayout` merges yaml + overrides
   + page-meta per page; `setOverrideLocal` does optimistic updates. Switching
   pages while editing drops the unsaved draft (intentional — see App.tsx).
5. **D1 binding name is `env.setsushin_dash`** (underscore). The `Env` interface
   lives in `functions/_lib/types.ts`; handlers are typed `PagesFunction<Env>`
   (and `PagesFunction<Env, 'id'>` for dynamic routes).
6. **Tone + mode are body data attrs.** `App.tsx` writes `data-tone`,
   `data-density`, `data-sidebar`, `data-radius`, `data-mode` on `<body>`, and
   `tokens.css` swaps CSS variables off those selectors. `--accent` is set inline;
   `--accent-soft` is derived live by `hexToSoft` (`src/lib/color.ts`).
7. **Widget config is `Record<string, unknown>`.** Each widget reads the fields
   it needs with a local cast (`config?.endpoint as string`). Request bodies in
   Functions are likewise untrusted at the boundary — validate + coerce
   (`functions/_lib/coerce.ts`, `patch.ts`).

## Data layer (D1)

| API | Table | Per-user | Notes |
|---|---|---|---|
| `/api/layout`    | `layout_overrides` | yes | GET map · PUT one · DELETE one or all |
| `/api/pages`     | `pages_local`      | yes | GET list · `pages/[id]` PUT/DELETE |
| `/api/tasks`     | `tasks`            | yes | GET list · POST · `tasks/[id]` PATCH/DELETE |
| `/api/assets`    | `assets`           | yes | GET list · POST · `assets/[id]` PATCH/DELETE |
| `/api/bookmarks` | `bookmarks_local`  | yes | GET (by bucket) · POST · `bookmarks/[id]` PATCH/DELETE |
| `/api/journal`   | `journal_entries`  | yes | GET list · POST · `journal/[id]` PATCH/DELETE |
| `/api/profile`   | `profile_items`    | yes | GET list · POST · `profile/[id]` PATCH/DELETE |

User identity comes from `getUserEmail(request, env)` in
`functions/_lib/auth.ts`: prod reads the `Cf-Access-Authenticated-User-Email`
header or decodes `Cf-Access-Jwt-Assertion` (CF Access verifies upstream);
local dev falls back to `LOCAL_DEV_USER_EMAIL` or `local@dev`. Functions never
trust client-provided identity.

Tasks mutations dispatch a typed `tasks-updated` window event
(`src/lib/events.ts`); `useTasksList` listens so the StatStrip counter updates
live. One-time migration on first task widget mount: if D1 is empty AND
`localStorage.tasks` has items, POST each then clear localStorage.

`widgets/assets.tsx` is full-width (`fixedSize.full`). Sunburst + list +
currency toggle (JPY/USD/CNY). FX from `/api/fx` (Frankfurter ECB, 1h cache,
hardcoded fallback on error). `scripts/seed-assets.mjs` parses `### L<N>`
sections from `~/setsushin-llm-pa/profile/assets.md` and POSTs to `/api/assets`.

## Read-only data fetching

Pages Function at `functions/api/<name>.ts` proxies a public API. Widget config
in `layout.yml` carries `endpoint: /api/<name>` plus per-widget params.
`useFetch` adds a 5–10min `sessionStorage` TTL cache; the Function adds
`Cache-Control: max-age=600` so CF edge caches too.

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
runtime-fetched files (`/`, `/layout.yml`, `/schedule.yml`, icons) load and
index.html ships a bundled module script; (2) every Function is reachable;
(3) source outside `dist/` is fenced off (404 / SPA fallback); (4) full CRUD
round-trips for layout/tasks/bookmarks/pages/assets/profile plus 400/404 cases.

Run after every feature commit. Exits 1 on first red. Override base URL with
`SMOKE_URL=…`.
