-- Analytics database, v0.76.0 (BOT_PROTECTION Part 4a): two new columns on `events`.
-- Run ONCE, only on a database that was made before v0.76.0 (it has no `acted` and `webdriver` columns):
--   npx wrangler d1 execute <database-name> --remote --file=workers/analytics/migrate-0.76.0.sql
-- Do NOT run it on a database made from the new schema.sql (it already has the columns and SQLite would answer "duplicate column name").
-- Old rows get 0 in both columns, which means "no real action seen" (they count as unverified once Part 4b counts them).
ALTER TABLE events ADD COLUMN acted     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN webdriver INTEGER NOT NULL DEFAULT 0;
