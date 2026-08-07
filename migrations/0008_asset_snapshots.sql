-- 0008_asset_snapshots: dated point-in-time copies of the assets table,
-- saved from the Finance page for markdown history export.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote   (after sign-off)
--
-- data is the JSON array of asset rows (same shape as GET /api/assets).
-- One snapshot per JST day per user — same-day saves overwrite.

CREATE TABLE IF NOT EXISTS asset_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email  TEXT NOT NULL,
  taken_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  data        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_taken
  ON asset_snapshots(user_email, taken_at DESC);
