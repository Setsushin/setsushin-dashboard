-- 0011: layout is code again (src/pages). Per-user grid overrides and page
-- metadata no longer have a UI or an API; drop the tables.
DROP TABLE IF EXISTS layout_overrides;
DROP TABLE IF EXISTS pages_local;
