// Shared types for Cloudflare Pages Functions.

export interface Env {
  // D1 binding name is `setsushin_dash` (underscore) — matches wrangler.toml.
  setsushin_dash: D1Database;
  // R2 bucket for journal inline images (functions/api/images.ts).
  JOURNAL_IMAGES: R2Bucket;
  // Local-dev identity fallback (functions/_lib/auth.ts).
  LOCAL_DEV_USER_EMAIL?: string;
  // Secret ICS URLs are bound as CALENDAR_<KEY>_ICS; read via a cast helper.
}
