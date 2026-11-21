-- Push database, v0.100.0 (Phase 9 part 8c-1): the new table push_less (one row for each "Less like this" tap).
-- Run ONCE on a database that was made before v0.100.0:
--   cd workers/push ; npx wrangler d1 execute <database-name> --remote --file=migrate-0.100.0.sql
-- It is safe to run again (IF NOT EXISTS) and it is also safe on a database made from the new schema.sql. Nothing is deleted and no row changes.
-- Without it everything still works: the taps move the weights; only the offer "Remove this topic?" does not appear until the table exists.
CREATE TABLE IF NOT EXISTS push_less (
  sub_id   INTEGER NOT NULL,
  category TEXT    NOT NULL,                               -- the category in lower case, as in push_posts
  ts       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_less_sub ON push_less (sub_id, category, ts);
CREATE INDEX IF NOT EXISTS push_less_ts ON push_less (ts);
