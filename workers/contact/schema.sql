-- Contact messages database for Cloudflare D1 (PLAN 16; BUGS N6).
-- Apply once:  npx wrangler d1 execute news-contact --remote --file=schema.sql
-- Safe to run again (every statement is IF NOT EXISTS).
-- No IP address is stored. All times are whole seconds since 1970 in UTC, set by the Worker.

CREATE TABLE IF NOT EXISTS contact_messages (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,                  -- set by the Worker, never by the browser
  name     TEXT    NOT NULL,                  -- one line, 1 to 100 characters
  email    TEXT    NOT NULL,                  -- lower case, checked
  subject  TEXT    NOT NULL DEFAULT '',       -- one line, may be empty
  message  TEXT    NOT NULL,                  -- plain text, 10 to 4000 characters
  status   TEXT    NOT NULL DEFAULT 'new'     -- new, read or done (the inbox screen comes later)
);
CREATE INDEX IF NOT EXISTS contact_ts ON contact_messages (ts);
CREATE INDEX IF NOT EXISTS contact_email_ts ON contact_messages (email, ts);
