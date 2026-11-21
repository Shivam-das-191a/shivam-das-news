// Auto image hosting, the result list (PLAN 34.3 steps 8 and 9, PLAN 34.5, LOGICS 22; Phase 3c Part 3c-4, v0.101.48).
// Pure: no network, no screen, no storage, no clock. hostPost (hosting-run.js) answers with `items`, one line for each picture. This file turns that answer into the DATA of
// the result list that the dashboard will draw: one row for each picture with a label, a plain sentence and the one action it offers (Retry, Confirm, Replace or nothing),
// one headline sentence, the addresses for Retry and Confirm, and the two small helpers the buttons need.
//   buildResultList(run)            -> { rows, counts, headline, retry, confirm, fix, canSave, notice, autoAltCount }
//   confirmFor(list, confirmed, o)  -> the new `confirmed` list for hostPost after the writer pressed Confirm (only for pictures that really wait for it)
//   carryOver(run)                  -> { post, map }: what the next hostPost (Retry or Confirm) starts from, so a picture that is already hosted is never downloaded twice
// Rules: a failed picture can be tried again only when trying again can help (RETRYABLE); a failed picture that cannot be fixed by waiting is shown with the action `replace`;
// a refused picture is never offered Retry or Confirm; Confirm is offered only for the pictures that wait for it; nothing is invented and nothing is sent anywhere.
// All text in a row comes from the run or from this file. The screen must show it as TEXT (never as HTML): the address of a picture is written by someone else.
// It writes nothing and nothing calls it yet, so the live site and the dashboard do not change.
import { RIGHTS_NOTICE, sourceHostOf } from './hosted-meta.js';
import { explain } from './hosting-run.js';

/** The reason words for which trying again can help (the other website was slow, the service was busy, the sign in ran out, a damaged answer). */
export const RETRYABLE = new Set(['timeout', 'network', 'dns_failed', 'http_error', 'call_too_big', 'worker_failed', 'sign_in', 'rate_limited', 'worker_off', 'bad_data', 'missing', 'optimize_failed']);

/** The label of each status word of hostPost. */
export const LABELS = { hosted: 'Hosted', reuse: 'Already hosted', failed: 'Failed', needs_confirm: 'Needs confirmation', refused: 'Refused' };

/** The word for the colour of a row: good (done), info (nothing to do), warn (waits for the writer), bad (did not work). */
export const TONES = { hosted: 'good', reuse: 'info', needs_confirm: 'warn', failed: 'bad', refused: 'bad' };

/** The longest address shown in a row (the full address stays in `url`). */
export const SHORT_MAX = 70;

/** One address cut for a narrow row: no https://, no #fragment, cut with three dots. */
export function shortUrl(url) {
  const s = String(url ?? '').replace(/^https?:\/\//i, '').replace(/#.*$/, '');
  return s.length <= SHORT_MAX ? s : `${s.slice(0, SHORT_MAX - 3)}...`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const bare = (u) => { try { const x = new URL(u); x.hash = ''; return x.href; } catch { return ''; } };

function rowOf(raw, n) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const status = LABELS[item.status] ? item.status : 'failed'; // an unknown status is shown as failed, with no Retry
  const url = String(item.url ?? '');
  const base = {
    n, url, short: shortUrl(url), host: sourceHostOf(url), where: item.where ? String(item.where) : '',
    status, label: LABELS[status], tone: TONES[status], action: 'none', reason: '', text: '', hint: '', src: '', by: '', autoAlt: false,
  };
  if (status === 'hosted') return { ...base, src: String(item.src || ''), autoAlt: item.autoAlt === true, text: `Hosted on your site as ${item.src || 'a new file'}.`, hint: item.autoAlt === true ? 'The alt text was written for you. Please read it and correct it.' : '' };
  if (status === 'reuse') return { ...base, src: String(item.src || item.path || ''), by: String(item.by || ''), text: item.by === 'sha256' ? 'The same picture is already on your site. It was used again.' : 'This picture is already on your site. It was used again.' };
  if (status === 'needs_confirm') return { ...base, reason: 'needs_confirm', text: item.text || explain('needs_confirm'), action: 'confirm', hint: RIGHTS_NOTICE };
  if (status === 'refused') return { ...base, reason: String(item.reason || ''), text: String(item.text || explain(item.reason)), action: 'replace', hint: 'Use another picture, or remove this one.' };
  const reason = LABELS[item.status] ? String(item.reason || '') : '';
  const retry = RETRYABLE.has(reason);
  return { ...base, reason, text: String(item.text || explain(reason)), action: retry ? 'retry' : 'replace', hint: retry ? '' : 'Waiting will not fix this. Use another picture, or remove this one.' };
}

/**
 * The data of the result list for one run of hostPost.
 * run: { items, changed } (the answer of hostPost). Anything else gives an empty list.
 * Returns:
 *   rows          one row for each picture, in the order of the post: { n, url, short, host, where, status, label, tone, action, reason, text, hint, src, by, autoAlt }
 *                 action: 'retry' | 'confirm' | 'replace' | 'none'
 *   counts        { total, hosted, reuse, failed, retry, replace, needs_confirm, refused }   (failed counts all failed pictures, retry and replace split them)
 *   headline      one plain sentence for the top of the list
 *   retry         the addresses the Retry button sends again (failed pictures for which trying again can help; each address once)
 *   confirm       the addresses that wait for Confirm (each once)
 *   fix           the addresses that the writer must replace or remove (refused, and failed pictures that waiting cannot fix)
 *   canSave       true when the run changed the post or the media file (there is something to save)
 *   notice        the rights sentence, shown whenever a picture was hosted or waits for confirmation
 *   autoAltCount  how many hosted pictures have an alt text that was written automatically and still waits for a review
 */
export function buildResultList(run) {
  const items = run && Array.isArray(run.items) ? run.items : [];
  const rows = items.map((item, i) => rowOf(item, i + 1));
  const counts = { total: rows.length, hosted: 0, reuse: 0, failed: 0, retry: 0, replace: 0, needs_confirm: 0, refused: 0 };
  const once = (list, url) => { if (url && !list.includes(url)) list.push(url); };
  const retry = [];
  const confirm = [];
  const fix = [];
  let autoAltCount = 0;
  for (const r of rows) {
    counts[r.status]++;
    if (r.status === 'failed') counts[r.action === 'retry' ? 'retry' : 'replace']++;
    if (r.action === 'retry') once(retry, r.url);
    if (r.action === 'confirm') once(confirm, r.url);
    if (r.action === 'replace') once(fix, r.url);
    if (r.status === 'hosted' && r.autoAlt) autoAltCount++;
  }
  return {
    rows, counts, headline: headlineOf(counts), retry, confirm, fix,
    canSave: !!(run && run.changed === true),
    notice: counts.hosted > 0 || counts.needs_confirm > 0 ? RIGHTS_NOTICE : '',
    autoAltCount,
  };
}

function headlineOf(c) {
  if (c.total === 0) return 'There are no outside pictures in this post.';
  const done = c.hosted + c.reuse;
  if (done === c.total) return `All ${plural(c.total, 'picture is', 'pictures are')} on your site.`;
  const parts = [];
  if (c.hosted) parts.push(`${c.hosted} hosted`);
  if (c.reuse) parts.push(`${c.reuse} already hosted`);
  if (c.needs_confirm) parts.push(`${c.needs_confirm} waiting for your confirmation`);
  if (c.failed) parts.push(`${c.failed} failed`);
  if (c.refused) parts.push(`${c.refused} refused`);
  return `${plural(c.total, 'picture', 'pictures')}: ${parts.join(', ')}.`;
}

/**
 * The new `confirmed` list for the next hostPost, after the writer pressed Confirm.
 * list: the answer of buildResultList. confirmed: the list that is already confirmed (addresses or hosts). o: { urls (only these; default every picture that waits), wholeHost (true: confirm the whole website) }.
 * Only a picture that really waits for confirmation can be confirmed: any other address is ignored, so a button cannot confirm a refused picture or a made up address.
 * An address is confirmed without its #fragment; with wholeHost the host name is confirmed instead. Nothing is added twice. The input list is not changed.
 */
export function confirmFor(list, confirmed = [], o = {}) {
  const waiting = new Map((list && Array.isArray(list.rows) ? list.rows : []).filter((r) => r.action === 'confirm').map((r) => [r.url, r]));
  const wanted = Array.isArray(o.urls) ? o.urls : [...waiting.keys()];
  const out = Array.isArray(confirmed) ? [...confirmed] : [];
  for (const u of wanted) {
    const r = waiting.get(u);
    if (!r) continue;
    const value = o.wholeHost === true ? r.host : bare(r.url);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * What the next hostPost (Retry or Confirm) starts from: the post with the hosted addresses already written in and the new media map.
 * The next run finds only the pictures that are still outside, so a picture that is already hosted is not downloaded again. The input is not changed.
 * Returns { post, map }; both are null when the run has no post.
 */
export function carryOver(run) {
  if (!run || typeof run !== 'object' || !run.post || typeof run.post !== 'object') return { post: null, map: null };
  return { post: { ...run.post }, map: run.map && typeof run.map === 'object' && !Array.isArray(run.map) ? { ...run.map } : {} };
}
