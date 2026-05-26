# setsushin-dashboard

**[Live demo →](https://mydash-demo.setsushin.top)** — dummy data, runs entirely in your browser (nothing saved server-side).

A personal start page — the handful of things worth checking in one place,
plus a few that are annoying to look up anywhere else.

- **Home** — calendar, tasks, markets, bookmarks, and a combined RSS + YouTube feed
- **Finance** — portfolio breakdown (sunburst by layer / currency) with live FX
- **Feed** — the full reading stream, one column per source
- **Journal** — a quiet markdown writing space
- **Profile** — numbers you always need but never remember (passport, glasses Rx, …)

Layouts are config-driven (`layout.yml`) and editable in-place; per-user state
(tasks, assets, bookmarks, journal, profile, layout tweaks) lives in Cloudflare D1.

## Stack

React 18 + TypeScript SPA bundled with **Vite**. Hosted on Cloudflare Pages,
with Pages Functions (TypeScript) for the backend and D1 for storage.
Single-user, gated by Cloudflare Access in production.

## Run it

```sh
npm install
npm run dev        # vite dev server → http://127.0.0.1:8787 (proxies /api → :8788)
npm run dev:cf     # wrangler pages dev → Functions + D1 on :8788
npm test           # vitest unit tests
npm run typecheck  # tsc (app + functions)
npm run build      # tsc + vite build → dist/
npm run smoke      # end-to-end check against a running dev server
npm run deploy     # build + ship to Cloudflare Pages
```

Full local dev runs both `npm run dev` (UI, HMR) and `npm run dev:cf`
(Functions + D1); the Vite server proxies `/api/*` to wrangler.

Architecture, conventions, and how to add a widget live in
[CLAUDE.md](./CLAUDE.md).
