# my-dashboard

Personal dashboard. React 18 SPA (CDN babel-standalone, no build step) deployed
to Cloudflare Pages, with Pages Functions handling backend (markets, calendar,
RSS+YouTube feed). Layout is config-driven via `layout.yml`.

## Local dev

```sh
npm test                              # node --test
npx wrangler@latest pages dev .       # http://127.0.0.1:8787
```

`wrangler pages dev .` serves the static root + runs Pages Functions in
`functions/api/*.js`.

## Adding a widget type

1. `widgets/<type>.jsx` ending in `registerWidget('<type>', Component)`. Use
   `<Panel title=… hint=… action=…>` shell from `core.jsx`.
2. Add a `<script type="text/babel" src="widgets/<type>.jsx"></script>` to
   `index.html` (before `boot.jsx`).
3. Reference in `layout.yml`: `- type: <type>` with optional `config:`, `size:`,
   `span:`.

## Layout (`layout.yml`)

Two lego layers:

- `nav.id ↔ pages[].id` — sidebar item routes to the page with the same id
  via `window.location.hash`.
- `grid[].size` (`large` | `compact`) + `grid[].span` (1..N columns) — each
  widget can render compactly and span multiple grid columns.

## Backend (Pages Functions)

| route | reads | notes |
|---|---|---|
| `/api/markets` | Yahoo Finance v8 chart API | crumb dance + 2h crumb cache |
| `/api/calendar` | env `CALENDAR_<KEY>_ICS` (Google ICS, etc.) | `?source=primary` → `CALENDAR_PRIMARY_ICS` |
| `/api/feed` | RSS + YouTube Atom (hardcoded sources) | 8s per-source timeout |

Each Function adds `Cache-Control: max-age=600`; the widget side adds
sessionStorage TTL cache; CF edge caches too. Three layers → real upstream
hits are rare.

### Secret URLs (Calendar ICS, future API tokens)

- Local dev: `wrangler.toml [vars]` (commented examples in the file).
- Prod: CF Pages dashboard → Settings → Environment variables.
- Naming: `CALENDAR_<KEY>_ICS` (uppercased, `_ICS` suffix).

Never put secret URLs in `layout.yml`.

## File layout

```
public/                  ← static asset root (deployed to CF Pages)
  index.html  boot.jsx  core.jsx  tweaks-panel.jsx  styles.css
  layout.yml  schedule.yml
  icons/  widgets/<type>.jsx

functions/               ← CF Pages Functions (deployed as workers)
  _lib/auth.js
  api/calendar.js  api/feed.js  api/layout.js  api/markets.js

migrations/              ← D1 schema, dev-only (NOT deployed)
test/                    ← node --test units, dev-only (NOT deployed)
wrangler.toml package.json README.md CLAUDE.md .gitignore
```

`pages_build_output_dir = "public"` in `wrangler.toml` keeps `migrations/`,
`test/`, `package.json`, etc. off the edge.

## Deploy

CF Pages — project root = repo root, Build output directory = `public`.
Functions auto-discover at `functions/` regardless. No build step.
