-- 0003_pages: per-user page metadata.
--
-- One row per page the user has touched. Two roles in one table:
--   1. yaml-page override: page_id matches a layout.yml page → label/icon/
--      title/subtitle (any non-null) override the yaml defaults
--   2. user-added page:    page_id NOT in layout.yml → page is synthesized
--      at merge time from this row alone (label + icon required, title/
--      subtitle optional)
--
-- The "user-added vs override" distinction is derived at read time by
-- checking whether the page_id appears in layout.yml — no extra column.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS pages_local (
  user_email  TEXT NOT NULL,
  page_id     TEXT NOT NULL,
  label       TEXT,
  icon        TEXT,
  title       TEXT,
  subtitle    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_email, page_id)
);
