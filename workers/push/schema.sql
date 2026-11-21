-- Push notification database for Cloudflare D1 (PLAN 31.3, CODING_PLAN section 4; v0.50.0, Phase 9 part 1).
-- Apply once:  npx wrangler d1 execute news-push --remote --file=schema.sql
-- Safe to run again (every statement is IF NOT EXISTS).
-- All times are whole milliseconds since 1970 in UTC, set by the Worker (never by the browser).
-- NEVER stored (PLAN 31.3): IP address, name, email, user agent text, exact location, reading history.
-- The push endpoint address is a secret: it is never logged and never shown in full (only endpoint_hash is shown).

-- One row per browser subscription. A new or cleared browser is a new subscriber (no cross-device profile, on purpose).
CREATE TABLE IF NOT EXISTS push_subs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint          TEXT    NOT NULL,                      -- secret, needed to send
  endpoint_hash     TEXT    NOT NULL UNIQUE,               -- short hash of the endpoint; subscribing twice gives one row (BUGS P18)
  p256dh            TEXT    NOT NULL,                      -- the browser's public key
  auth              TEXT    NOT NULL,                      -- the browser's auth secret
  token_hash        TEXT    NOT NULL,                      -- hash of the random manage token kept in the browser
  level             TEXT    NOT NULL DEFAULT 'balanced',   -- breaking_only, important, balanced, everything
  daily_limit       INTEGER NOT NULL DEFAULT 4,            -- 1, 2, 4 or 8
  tz                TEXT    NOT NULL DEFAULT 'UTC',        -- IANA zone NAME such as Asia/Kolkata, never an offset (BUGS P6)
  quiet_start       INTEGER DEFAULT 1320,                  -- minutes since local midnight (22:00); NULL = no quiet hours
  quiet_end         INTEGER DEFAULT 420,                   -- minutes since local midnight (07:00)
  breaking_all      INTEGER NOT NULL DEFAULT 1,            -- breaking news from any category
  breaking_in_quiet INTEGER NOT NULL DEFAULT 0,            -- breaking news during quiet hours
  learn_on          INTEGER NOT NULL DEFAULT 0,            -- "Learn from what I read"
  digest_mode       TEXT    NOT NULL DEFAULT 'off',        -- off, morning, evening, both
  digest_hours      TEXT    NOT NULL DEFAULT '[]',         -- JSON list of local hours, for example [8] or [8,20]
  top_categories    TEXT    NOT NULL DEFAULT '[]',         -- JSON list, at most 3 names (reading habit, names only)
  weights           TEXT    NOT NULL DEFAULT '{}',         -- JSON object, category -> number from -1 to 1 (learned)
  engagement        REAL    NOT NULL DEFAULT 0,
  sent_today        INTEGER NOT NULL DEFAULT 0,
  sent_day          TEXT,                                  -- local day "YYYY-MM-DD" that sent_today belongs to (reset when the day changes)
  last_sent         INTEGER,
  last_test         INTEGER,                               -- v0.62.0: when the reader last asked for a test notification (one a minute); never counts as a real send
  failures          INTEGER NOT NULL DEFAULT 0,            -- failures in a row; 5 pause the subscriber (BUGS P5)
  paused_until      INTEGER,                               -- NULL = not paused
  country           TEXT,                                  -- two letters from the edge, only for the consent rule and an aggregate map
  status            TEXT    NOT NULL DEFAULT 'active',     -- active, paused, gone
  created           INTEGER NOT NULL,
  last_seen         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subs_status ON push_subs (status, last_seen);
CREATE INDEX IF NOT EXISTS push_subs_breaking ON push_subs (breaking_all, status);

-- What a reader follows. kind: cat (category), kw (keyword phrase), mute (muted phrase), author,
-- kwtok (one row for each word of each kw phrase: the keyword index, made with keywordIndexTerms in lib.js),
-- kwtext and mutetext (v0.52.0: the keyword or muted phrase as the reader wrote it, so the preference page can show it again;
-- kw and mute hold the cleaned form used for matching, which is stemmed and not readable). Audience search never reads kwtext or mutetext.
-- Audience search reads (kind, term) only, never every subscriber (PLAN 31.4 step 4).
CREATE TABLE IF NOT EXISTS push_terms (
  sub_id INTEGER NOT NULL,
  kind   TEXT    NOT NULL,
  term   TEXT    NOT NULL,
  PRIMARY KEY (sub_id, kind, term)
);
CREATE INDEX IF NOT EXISTS push_terms_lookup ON push_terms (kind, term);

-- A summary of each announced post. key is the permalink: it is unique, so the same post cannot be announced twice (BUGS P2).
-- Kept 3 days (used for digests and thread checks), then cleaned.
CREATE TABLE IF NOT EXISTS push_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT    NOT NULL UNIQUE,
  url          TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  category     TEXT    NOT NULL DEFAULT '',
  tags         TEXT    NOT NULL DEFAULT '[]',              -- JSON list
  focus        TEXT    NOT NULL DEFAULT '',
  author       TEXT    NOT NULL DEFAULT '',
  flags        TEXT    NOT NULL DEFAULT '{}',              -- JSON: breaking, featured, trending, push; and when set pushTitle, pushBody, imageWidth, wordCount (v0.64.0)
  image        TEXT,
  published_at INTEGER NOT NULL,
  announced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_posts_published ON push_posts (published_at);

-- Messages waiting to be sent. The sender takes 36 at a time (PLAN 31.11, sender.js).
-- A database made before v0.68.0 needs one more line, once:  npx wrangler d1 execute news-push --remote --command "ALTER TABLE push_queue ADD COLUMN next_try INTEGER NOT NULL DEFAULT 0"
CREATE TABLE IF NOT EXISTS push_queue (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_id   INTEGER NOT NULL,
  post_key TEXT    NOT NULL,
  score    REAL    NOT NULL,
  thread   TEXT    NOT NULL,
  ttl      INTEGER NOT NULL,                               -- seconds, from TTL_SEC in lib.js
  urgency  TEXT    NOT NULL DEFAULT 'normal',              -- high, normal, low
  state    TEXT    NOT NULL DEFAULT 'queued',              -- queued, sending, sent, failed, expired
  tries    INTEGER NOT NULL DEFAULT 0,
  created  INTEGER NOT NULL,
  next_try INTEGER NOT NULL DEFAULT 0,                     -- v0.68.0: not before this time (ms): the wait before a retry, and the end of the claim of a message being sent (sender.js)
  UNIQUE (sub_id, post_key)                                -- one queued message for one reader and one post
);
CREATE INDEX IF NOT EXISTS push_queue_next ON push_queue (state, created);

-- Stories held for later (quiet hours, minimum gap, digest). At most 5 per reader, 6 hours.
CREATE TABLE IF NOT EXISTS push_held (
  sub_id   INTEGER NOT NULL,
  post_key TEXT    NOT NULL,
  score    REAL    NOT NULL,
  expires  INTEGER NOT NULL,
  PRIMARY KEY (sub_id, post_key)
);
CREATE INDEX IF NOT EXISTS push_held_expires ON push_held (expires);

-- One compact row per send: the duplicate guard and the story-thread check. Kept 30 days.
CREATE TABLE IF NOT EXISTS push_sent (
  sub_id   INTEGER NOT NULL,
  post_key TEXT    NOT NULL,
  ts       INTEGER NOT NULL,
  thread   TEXT    NOT NULL,
  PRIMARY KEY (sub_id, post_key)
);
CREATE INDEX IF NOT EXISTS push_sent_sub_ts ON push_sent (sub_id, ts);
CREATE INDEX IF NOT EXISTS push_sent_ts ON push_sent (ts);

-- One row per announce: who or what announced, how many candidates, how many sent. Kept 30 days (PLAN 31.10).
CREATE TABLE IF NOT EXISTS push_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,
  who        TEXT    NOT NULL,                             -- "action" or a GitHub login
  post_key   TEXT    NOT NULL,
  candidates INTEGER NOT NULL DEFAULT 0,
  sent       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_audit_ts ON push_audit (ts);

-- v0.100.0 (part 8c-1): one row for each "Less like this" tap of a reader (the category, the time, nothing else). Kept 30 days; used only to count the taps per category (PLAN 31.8).
-- An old database needs this table: run workers/push/migrate-0.100.0.sql once (it is safe to run again). Without it the taps still move the weights; only the offer "Remove this topic?" does not appear.
CREATE TABLE IF NOT EXISTS push_less (
  sub_id   INTEGER NOT NULL,
  category TEXT    NOT NULL,                               -- the category in lower case, as in push_posts
  ts       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_less_sub ON push_less (sub_id, category, ts);
CREATE INDEX IF NOT EXISTS push_less_ts ON push_less (ts);
