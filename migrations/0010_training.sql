-- 0010_training: per-user KV behind the training card widget.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote
--
-- key = 'weights'         → { [exerciseId]: kg | null }
-- key = 'log:YYYY-MM-DD'  → { day, ticks: { [exerciseId]: boolean[] } }  (JST day)

CREATE TABLE IF NOT EXISTS training_state (
  user_email  TEXT NOT NULL,
  key         TEXT NOT NULL,
  data        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_email, key)
);
