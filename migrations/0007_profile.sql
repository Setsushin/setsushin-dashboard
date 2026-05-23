-- 0007_profile: personal reference items for the Profile page.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote   (after sign-off)
--
-- Stuff you look up rarely but always need fast: passport number, glasses
-- prescription, company phone, etc. category is a free-form bucket the
-- widget groups by (null → "Other"). value is plaintext (multi-line allowed,
-- e.g. an L/R glasses Rx); the site is single-user behind CF Access.

CREATE TABLE IF NOT EXISTS profile_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email  TEXT NOT NULL,
  category    TEXT,
  label       TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  note        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_profile_user_cat ON profile_items(user_email, category, sort_order);
