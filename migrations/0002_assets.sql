-- 0002_assets: portfolio asset rows for the Finance page.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote   (after sign-off)
--
-- Layer is the coarse class (L1 Cash / L2 Bonds-MMF-Stable / L3 Taxable / L4 NISA).
-- Sublayer is optional finer grouping (L1a / L1b for cash; null otherwise).
-- jpy_man is the amount in 万日元 (REAL — allow fractional for partial positions).
-- exposure is the FX exposure tag: 'jpy' | 'usd' | 'mixed-50-50' (商社 case).

CREATE TABLE IF NOT EXISTS assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email  TEXT NOT NULL,
  layer       TEXT NOT NULL,
  sublayer    TEXT,
  name        TEXT NOT NULL,
  jpy_man     REAL NOT NULL,
  exposure    TEXT NOT NULL,
  account     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_assets_user_layer ON assets(user_email, layer, sort_order);
