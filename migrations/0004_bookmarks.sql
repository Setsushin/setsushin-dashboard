-- 0004_bookmarks: per-user, per-bucket bookmark lists for in-UI editing.
--
-- "bucket" is conventionally a page_id (one strip per page) but it's just a
-- free-form string, so multiple pages can share one strip by reusing the
-- same key. The legacy `items:` array in layout.yml still works for static
-- strips that don't need editing — bucket vs items are mutually exclusive
-- at the widget level.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS bookmarks_local (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email  TEXT NOT NULL,
  bucket      TEXT NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  mark        TEXT,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_bucket
  ON bookmarks_local(user_email, bucket, sort_order, id);
