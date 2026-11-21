// v0.94.0 (Phase 9 part 7d): pure helpers for the deploy job that tells the push Worker about new posts (PLAN 31.4 step 2).
// No network, no clock of its own (the caller gives "now"), no file reading: a text goes in, a post (or null) comes out.
// The Worker (workers/push/announce.js) checks everything again. These helpers only avoid sending what can never pass,
// so the job stays quiet and cheap. The key of a post is its permalink: the Worker never sends the same key twice.

import { dateParts } from './indexnow-lib.mjs';
import { findEmoji } from './no-emoji-lib.mjs';

export const MAX_AGE_MIN = 120; // same as the Worker (PLAN 31.5, maxAgeMinutes)
export const MAX_POSTS = 25; // the Worker refuses more in one call
export const FUTURE_SLACK_MS = 5 * 60000; // same as the Worker
export const SECRET_HEADER = 'X-Announce-Secret';
// A post that the live check could not open yet (the deploy may still be spreading). Only these are asked again.
export const RETRY_REASONS = ['not_live', 'check_failed'];

/** A value as the dashboard writes it: a double quoted JSON string (quotes and backslashes escaped) or a single quoted YAML string. */
function stripQuotes(v) {
  const t = v.trim();
  if (t.length >= 2 && t[0] === '"' && t.endsWith('"')) {
    try {
      const parsed = JSON.parse(t);
      if (typeof parsed === 'string') return parsed;
    } catch {
      /* fall through to the plain rule */
    }
  }
  if (t.length >= 2 && t[0] === "'" && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t.replace(/^["']|["']$/g, '');
}

/** Reads the front matter block: plain values, true/false, inline lists ["a", "b"] and block lists ("  - a"). Returns null when there is none. */
export function readFront(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text ?? ''));
  if (!m) return null;
  const out = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      out[listKey].push(stripQuotes(item[1]));
      continue;
    }
    listKey = null;
    const k = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (!k) continue;
    const raw = k[2].trim();
    if (raw === '') {
      out[k[1]] = [];
      listKey = k[1];
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const arr = JSON.parse(raw);
        out[k[1]] = Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
      } catch {
        out[k[1]] = raw.slice(1, -1).split(',').map(stripQuotes).filter(Boolean);
      }
    } else if (raw === 'true' || raw === 'false') {
      out[k[1]] = raw === 'true';
    } else {
      out[k[1]] = stripQuotes(raw);
    }
  }
  return out;
}

/** The text after the front matter. */
export const bodyOf = (text) => String(text ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

/** Words in the body (Markdown marks and links removed): the Worker only uses it as a small hint. */
export function countWords(body) {
  const plain = String(body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ');
  const words = plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length;
}

const absolute = (value, siteUrl) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  if (/^https:\/\//i.test(v)) return v;
  if (v.startsWith('/') && !v.startsWith('//')) return siteUrl + v;
  return null; // http:// and other forms are left out: the Worker needs https
};

const cleanList = (list) => (Array.isArray(list) ? list : []).map((t) => String(t).trim()).filter((t) => t.length >= 1 && t.length <= 60).slice(0, 20);

/**
 * One content file to one announce post, or null when it can never be announced (not a post, not published, no date).
 * Time and quality rules that depend on "now" are in selectRecent. The editor fields push, pushTitle and pushBody are read when
 * they exist (they come with part 7e); until then every post is "auto".
 */
export function postFromFile(file, text, { timeZone = 'UTC', siteUrl = '' } = {}) {
  if (!/(^|\/)content\/blogs\//.test(file)) return null;
  const fm = readFront(text);
  if (!fm || fm.status !== 'published') return null;
  if (!fm.permalink || !fm.category || !fm.title) return null;
  const date = new Date(fm.date);
  if (Number.isNaN(date.getTime())) return null;
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const { y, m, d } = dateParts(date, timeZone);
  const post = {
    key: fm.permalink,
    url: `${base}/${y}/${m}/${d}/blogs/${fm.category}/${fm.permalink}/`,
    title: fm.title,
    description: typeof fm.description === 'string' ? fm.description : '',
    category: fm.category,
    tags: cleanList(fm.tags),
    focus: typeof fm.focusKeyword === 'string' ? fm.focusKeyword.slice(0, 80) : '',
    author: typeof fm.author === 'string' ? fm.author : '',
    breaking: fm.breaking === true,
    featured: fm.featured === true,
    trending: fm.trending === true,
    robots: typeof fm.robots === 'string' ? fm.robots : '',
    status: 'published',
    wordCount: countWords(bodyOf(text)),
    publishedAt: date.toISOString(),
  };
  const image = absolute(fm.image, base);
  if (image) post.image = image;
  if (['auto', 'off', 'force'].includes(fm.push)) post.push = fm.push;
  if (typeof fm.pushTitle === 'string' && fm.pushTitle) post.pushTitle = fm.pushTitle;
  if (typeof fm.pushBody === 'string' && fm.pushBody) post.pushBody = fm.pushBody;
  return post;
}

/**
 * Why a post is not sent from the job (the Worker still decides alone), or null when it may go on.
 * Same order as the Worker for the rules that need no network: push off, noindex, not yet live, too old, emoji.
 */
export function skipReason(post, now) {
  if (post.push === 'off') return 'push_off';
  if (/noindex/i.test(post.robots || '')) return 'noindex';
  const at = Date.parse(post.publishedAt);
  if (!Number.isFinite(at)) return 'bad_date';
  if (at > now + FUTURE_SLACK_MS) return 'not_yet';
  if (now - at > MAX_AGE_MIN * 60000) return 'too_old';
  const text = [post.title, post.description, post.pushTitle, post.pushBody].filter(Boolean).join(' ');
  if (findEmoji(text).length) return 'emoji';
  return null;
}

/**
 * From a list of posts, the ones to send: newest first, at most MAX_POSTS.
 * Returns { send, skipped } where skipped is a list of { key, reason } for the log. Nothing is thrown away silently.
 */
export function selectRecent(posts, now) {
  const send = [];
  const skipped = [];
  const seen = new Set();
  for (const p of posts) {
    if (seen.has(p.key)) {
      skipped.push({ key: p.key, reason: 'duplicate' });
      continue;
    }
    seen.add(p.key);
    const reason = skipReason(p, now);
    if (reason) skipped.push({ key: p.key, reason });
    else send.push(p);
  }
  send.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || (a.key < b.key ? -1 : 1));
  for (const p of send.slice(MAX_POSTS)) skipped.push({ key: p.key, reason: 'too_many' });
  return { send: send.slice(0, MAX_POSTS), skipped };
}

/** The settings from the environment. `ready` is false when one is missing: the job then does nothing and says so (exit 0). */
export function readSettings(env) {
  const siteUrl = String(env.SITE_URL || '').trim().replace(/\/+$/, '');
  const endpoint = String(env.PUSH_ENDPOINT || '').trim().replace(/\/+$/, '');
  const secret = String(env.PUSH_ANNOUNCE_SECRET || '');
  const missing = [];
  if (!/^https:\/\//.test(siteUrl)) missing.push('SITE_URL');
  if (!/^https:\/\//.test(endpoint)) missing.push('PUSH_ENDPOINT');
  if (secret.length < 32) missing.push('PUSH_ANNOUNCE_SECRET');
  return { ready: missing.length === 0, missing, siteUrl, endpoint, secret };
}

/** The keys that the Worker could not open yet and that are worth asking again (never the ones it refused for a real reason). */
export function retryKeys(answer) {
  if (!answer || !Array.isArray(answer.results)) return [];
  return answer.results.filter((r) => r && r.status === 'skipped' && RETRY_REASONS.includes(r.reason) && typeof r.key === 'string').map((r) => r.key);
}

/** One short log line per result: the key, the status and the reason word. Never a title, a text or a secret. */
export function describeResults(answer) {
  if (!answer || !Array.isArray(answer.results)) return ['No results in the answer.'];
  return answer.results.map((r) => `${r.key || '(no key)'}: ${r.status}${r.reason ? ' (' + r.reason + (r.field ? ': ' + r.field : '') + ')' : ''}`);
}
