-- 0006_journal: free-form journal entries.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote   (after sign-off)
--
-- title: optional topic, rendered as a styled heading above the body.
-- body:  raw markdown, required.
-- tags:  JSON array stored as text ('["misc","work"]' or NULL); the widget
--        parses + renders chips. Kept opaque to the DB so we don't need a
--        junction table for the MVP.
-- updated_at: bumped explicitly on PATCH (D1 has no ON UPDATE trigger).

CREATE TABLE IF NOT EXISTS journal_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email  TEXT NOT NULL,
  title       TEXT,
  body        TEXT NOT NULL,
  tags        TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_journal_user_created
  ON journal_entries(user_email, created_at DESC);
