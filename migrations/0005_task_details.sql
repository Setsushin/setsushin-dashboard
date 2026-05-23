-- 0005_task_details: extend tasks with description + due_at.
--
-- Run locally:  npm run db:migrate:local
-- Run on prod:  npm run db:migrate:remote
--
-- description: long-form note, optional
-- due_at:      unix seconds (UTC), optional. NULL = no deadline.

ALTER TABLE tasks ADD COLUMN description TEXT;
ALTER TABLE tasks ADD COLUMN due_at      INTEGER;

CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_email, due_at);
