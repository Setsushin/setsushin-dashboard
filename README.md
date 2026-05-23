# setsushin-dashboard

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

React 18 SPA served via CDN babel-standalone — **no build step**. Hosted on
Cloudflare Pages, with Pages Functions for the backend and D1 for storage.
Single-user, gated by Cloudflare Access in production.

## Run it

```sh
npm run dev      # wrangler pages dev → http://127.0.0.1:8787
npm test         # unit tests
npm run smoke    # end-to-end check against the dev server
npm run deploy   # ship to Cloudflare Pages
```

Architecture, conventions, and how to add a widget live in
[CLAUDE.md](./CLAUDE.md).
