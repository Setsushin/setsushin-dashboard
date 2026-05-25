// Shared types for Cloudflare Pages Functions.

export interface Env {
  // D1 binding name is `setsushin_dash` (underscore) — matches wrangler.toml.
  setsushin_dash: D1Database;
  // Local-dev identity fallback (functions/_lib/auth.ts).
  LOCAL_DEV_USER_EMAIL?: string;
  // Secret ICS URLs are bound as CALENDAR_<KEY>_ICS; read via a cast helper.
}
