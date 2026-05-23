-- 0001_init: layout overrides (Plan Y) + tasks
--
-- Run locally:  wrangler d1 migrations apply setsushin-dash --local
-- Run on prod:  wrangler d1 migrations apply setsushin-dash --remote

-- Per-user, per-page grid override. Absent row → fall back to layout.yml grid.
-- grid_json is the array of widget specs ({type, size, span, config}).
CREATE TABLE IF NOT EXISTS layout_overrides (
  user_email  TEXT NOT NULL,
  page_id     TEXT NOT NULL,
  grid_json   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_email, page_id)
);

-- Tasks list. One row per task. Replaces widgets/tasks.jsx localStorage.
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email  TEXT NOT NULL,
  text        TEXT NOT NULL,
  tag         TEXT,
  kind        TEXT,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_done ON tasks(user_email, done);
