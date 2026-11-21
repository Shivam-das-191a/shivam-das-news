// Audience search (v0.66.0, Phase 9 part 6c; PLAN 31.4 step 4, PLAN 31.6 "Candidates", LOGICS 19 step 2, BUGS P-group).
// Given one announced post, find the readers who MIGHT want it. This part only FINDS. It scores nothing, applies no daily limit,
// no quiet hours and no gap (part 6d), and sends nothing (part 7).
// The search never scans every subscriber. It reads the indexes of push_terms (kind, term) and, for breaking news only, the
// push_subs_breaking index. A reader is a candidate when ONE of these is true:
//   1. the post's category is in the reader's category list        (door "cat")
//   2. a word of the reader's keywords is a word of the post         (door "kw", from the keyword index, kind "kwtok")
//   3. the post's author is in the reader's author list              (door "author")
//   4. the post is breaking and the reader wants breaking news from any category (door "breaking")
// Removed at once: status other than active, 5 or more failures in a row, paused until a time that has not come (PLAN 31.4, LOGICS 19 step 2).
// A word match through the keyword index is only a hint: the real strength is checked by keywordHit in part 6d.
// Pure functions and SQL text. The database object is given by the caller (the Worker gives D1, the tests give SQLite); no clock of its own.

import { MAX_FAILURES, postIndexTokens } from './lib.js';

export const DOORS = ['cat', 'kw', 'author', 'breaking'];
export const TOKEN_CHUNK = 60; // keyword words in one query: with the other values it stays under the 100 value limit of D1
export const MAX_POST_TOKENS = 240; // a post never needs more words than this to find its readers (title and tags come first)
export const MAX_CANDIDATES = 5000; // a safety limit for one post; a longer list is cut and the answer says so (the Worker is built for small sites, PLAN 31.11)
export const LOAD_CHUNK = 80; // subscriber rows read in one query

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** A reader who can still receive something: active, fewer than MAX_FAILURES failures in a row, not paused (the same rule as isEligible in lib.js). */
export const ELIGIBLE_SQL = `s.status = 'active' AND s.failures < ${MAX_FAILURES} AND (s.paused_until IS NULL OR s.paused_until <= ?)`;

/**
 * The keys a post uses to find readers.
 * Returns { category, author, tokens: [..], breaking }. tokens are the stemmed words of the title, focus keyword, tags and description
 * (the same function that built the keyword index, so a word matches its own stem), at most MAX_POST_TOKENS.
 */
export function audienceKeys(post) {
  const p = post || {};
  return {
    category: norm(p.category),
    author: norm(p.author),
    tokens: postIndexTokens(p).slice(0, MAX_POST_TOKENS),
    breaking: p.breaking === true,
  };
}

const marks = (n) => Array.from({ length: n }, () => '?').join(',');

/**
 * The queries that find the candidates of one post. Each is { door, sql, values }. A query returns rows with the column id.
 * Every query already joins push_subs and keeps only eligible readers, so nobody who cannot receive is ever loaded.
 * `now` is a number (milliseconds, set by the Worker).
 */
export function candidateQueries(post, now) {
  const k = audienceKeys(post);
  const out = [];
  const join = 'FROM push_terms t JOIN push_subs s ON s.id = t.sub_id';
  if (k.category) out.push({ door: 'cat', sql: `SELECT DISTINCT s.id AS id ${join} WHERE t.kind = 'cat' AND t.term = ? AND ${ELIGIBLE_SQL}`, values: [k.category, now] });
  if (k.author) out.push({ door: 'author', sql: `SELECT DISTINCT s.id AS id ${join} WHERE t.kind = 'author' AND t.term = ? AND ${ELIGIBLE_SQL}`, values: [k.author, now] });
  for (let i = 0; i < k.tokens.length; i += TOKEN_CHUNK) {
    const part = k.tokens.slice(i, i + TOKEN_CHUNK);
    out.push({ door: 'kw', sql: `SELECT DISTINCT s.id AS id ${join} WHERE t.kind = 'kwtok' AND t.term IN (${marks(part.length)}) AND ${ELIGIBLE_SQL}`, values: [...part, now] });
  }
  if (k.breaking) out.push({ door: 'breaking', sql: `SELECT s.id AS id FROM push_subs s WHERE s.breaking_all = 1 AND ${ELIGIBLE_SQL}`, values: [now] });
  return out;
}

/** The columns a later part needs about a candidate. NOT the endpoint or the two keys: those are read only at send time (part 7). */
export const SUB_COLUMNS = 'id, status, level, daily_limit, tz, quiet_start, quiet_end, breaking_all, breaking_in_quiet, learn_on, digest_mode, digest_hours, top_categories, weights, engagement, sent_today, sent_day, last_sent, failures, paused_until, country';

/** One query that loads the subscriber rows for a list of ids (at most LOAD_CHUNK). */
export const loadSubsSql = (n) => `SELECT ${SUB_COLUMNS} FROM push_subs WHERE id IN (${marks(n)}) ORDER BY id`;

const rowsOf = (r) => (r && Array.isArray(r.results) ? r.results : []);

/**
 * Finds the candidates of one post.
 * db: an object with prepare(sql).bind(...values).all() (D1 or the test fake).
 * Returns { ids: [..], via: { id: [doors] }, truncated: boolean, counts: { cat, kw, author, breaking } }.
 * ids are sorted, without duplicates. A reader found through two doors appears once, with both doors in via.
 * counts says how many readers each door found (a reader found twice counts in both). If one query fails the error goes up:
 * "When unsure, do not send" (PLAN 31.10), so the caller must stop and not use a half list.
 */
export async function findCandidates(db, post, now) {
  const via = new Map();
  const counts = { cat: 0, kw: 0, author: 0, breaking: 0 };
  for (const q of candidateQueries(post, now)) {
    const res = rowsOf(await db.prepare(q.sql).bind(...q.values).all());
    const seen = new Set();
    for (const r of res) {
      const id = Number(r.id);
      if (!Number.isInteger(id) || seen.has(id)) continue;
      seen.add(id);
      if (!via.has(id)) via.set(id, new Set());
      via.get(id).add(q.door);
    }
    counts[q.door] += seen.size;
  }
  let ids = [...via.keys()].sort((a, b) => a - b);
  const truncated = ids.length > MAX_CANDIDATES;
  if (truncated) ids = ids.slice(0, MAX_CANDIDATES);
  const viaObj = {};
  for (const id of ids) viaObj[id] = DOORS.filter((d) => via.get(id).has(d));
  return { ids, via: viaObj, truncated, counts };
}

/** Loads the subscriber rows (without secrets) of the candidate ids, in chunks. Returns the rows sorted by id. */
export async function loadCandidates(db, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += LOAD_CHUNK) {
    const part = ids.slice(i, i + LOAD_CHUNK);
    rows.push(...rowsOf(await db.prepare(loadSubsSql(part.length)).bind(...part).all()));
  }
  return rows.sort((a, b) => a.id - b.id);
}
