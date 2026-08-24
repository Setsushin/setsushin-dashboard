-- 0009_assets_usd: USD-exposed part of each row, in dollars.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote   (after sign-off)
--
-- A row's value = jpy_man (JPY-exposed part, 万円) + usd / rate / 1e4, so
-- usd/mixed-exposure rows float with the live FX rate. Backfill for existing
-- rows (rate = JPY per USD on the day):
--   UPDATE assets SET usd = round(jpy_man*1e4/<rate>,2), jpy_man = 0
--    WHERE exposure = 'usd' AND usd IS NULL;
--   UPDATE assets SET usd = round(jpy_man/2*1e4/<rate>,2), jpy_man = jpy_man/2
--    WHERE exposure = 'mixed-50-50' AND usd IS NULL;

ALTER TABLE assets ADD COLUMN usd REAL;
