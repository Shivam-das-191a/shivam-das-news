-- Analytics database for Cloudflare D1 (PLAN 15, CODING_PLAN section 4; BUGS N1 to N5).
-- Apply once:  npx wrangler d1 execute <database-name> --remote --file=workers/analytics/schema.sql
-- Safe to run again (every statement is IF NOT EXISTS).
-- A database made before v0.76.0 has no `acted` and `webdriver` columns: run migrate-0.76.0.sql once on it (NOT on a new database made from this file).
-- A database made before v0.77.0 has no `dc` column and no `verified_views` columns: run migrate-0.77.0.sql once on it (also NOT on a new database made from this file).
-- No IP address, no cookie value and no user agent text is stored (PLAN 15, storage and privacy).
-- All times are whole seconds since 1970 in UTC (BUGS N3); the dashboard turns them into the chosen time zone.

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,                  -- set by the Worker, never by the browser
  session_id    TEXT    NOT NULL,                  -- random id made in the browser, no personal data
  pv_id         TEXT    NOT NULL,                  -- one id per page view (BUGS N1: a second send updates the row)
  url           TEXT    NOT NULL,                  -- path only, no query and no hash
  country       TEXT    NOT NULL DEFAULT '',       -- two letters from the edge, '' when unknown
  tz            TEXT    NOT NULL DEFAULT '',       -- time zone name from the browser
  referrer_host TEXT    NOT NULL DEFAULT '',       -- host only, '' for direct or same-site
  device        TEXT    NOT NULL,                  -- mobile, tablet or desktop
  browser       TEXT    NOT NULL,                  -- Chrome, Safari, Firefox, Edge, ...
  read_seconds  INTEGER NOT NULL DEFAULT 0,        -- active time only (BUGS N4), capped by the Worker
  scroll_pct    INTEGER NOT NULL DEFAULT 0,        -- deepest scroll, 0 to 100
  acted         INTEGER NOT NULL DEFAULT 0,        -- v0.76.0: 1 when a real touch, key press, click or scroll of 20 percent happened (only goes up, 0 to 1)
  webdriver     INTEGER NOT NULL DEFAULT 0,        -- v0.76.0: 1 when the browser says a program drives it (only goes up, 0 to 1)
  dc            INTEGER NOT NULL DEFAULT 0         -- v0.77.0: 1 when the visit came from a datacenter network (the edge's number, BOT_PROTECTION Rule 3; only goes up)
);
CREATE UNIQUE INDEX IF NOT EXISTS events_page_view ON events (session_id, pv_id);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS events_url_ts ON events (url, ts);

-- Hourly and daily totals (BUGS N5: raw events are deleted after a few days, the totals stay).
-- hour and day are the start of the hour or day in UTC, in seconds.
CREATE TABLE IF NOT EXISTS rollup_hourly (
  hour             INTEGER NOT NULL,
  url              TEXT    NOT NULL,
  country          TEXT    NOT NULL DEFAULT '',
  referrer_host    TEXT    NOT NULL DEFAULT '',
  views            INTEGER NOT NULL DEFAULT 0,
  visitors         INTEGER NOT NULL DEFAULT 0,
  read_seconds_sum INTEGER NOT NULL DEFAULT 0,
  verified_views   INTEGER NOT NULL DEFAULT 0,   -- v0.77.0: views with acted 1, webdriver 0 and dc 0 (the rest are unverified: views minus this)
  PRIMARY KEY (hour, url, country, referrer_host)
);

CREATE TABLE IF NOT EXISTS rollup_daily (
  day              INTEGER NOT NULL,
  url              TEXT    NOT NULL,
  country          TEXT    NOT NULL DEFAULT '',
  referrer_host    TEXT    NOT NULL DEFAULT '',
  views            INTEGER NOT NULL DEFAULT 0,
  visitors         INTEGER NOT NULL DEFAULT 0,
  read_seconds_sum INTEGER NOT NULL DEFAULT 0,
  verified_views   INTEGER NOT NULL DEFAULT 0,   -- v0.77.0: as in rollup_hourly
  PRIMARY KEY (day, url, country, referrer_host)
);
