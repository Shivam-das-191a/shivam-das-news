-- Analytics database, v0.77.0 (BOT_PROTECTION Part 4b-1): one new column on `events` and one on each totals table.
-- Run ONCE, only on a database that was made before v0.77.0 (it has no `dc` and no `verified_views` columns):
--   npx wrangler d1 execute <database-name> --remote --file=workers/analytics/migrate-0.77.0.sql
-- A database made before v0.76.0 needs migrate-0.76.0.sql FIRST (the `acted` and `webdriver` columns), then this file.
-- Do NOT run it on a database made from the new schema.sql (it already has the columns and SQLite would answer "duplicate column name").
-- Old rows get 0: dc 0 means "not a datacenter", verified_views 0 means "no verified view counted". So the lifetime number of verified views starts from the day this version runs; older days show as unverified.
ALTER TABLE events ADD COLUMN dc INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rollup_hourly ADD COLUMN verified_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rollup_daily ADD COLUMN verified_views INTEGER NOT NULL DEFAULT 0;
