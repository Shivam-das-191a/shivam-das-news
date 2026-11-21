// Push control (Cloudflare Worker, v0.69.0, Phase 9 part 7b; PLAN 31.7, 31.10).
// The glue between the post announce, the delivery plan (plan.js) and the sender (sender.js). It holds the kill switch and the two entry points:
//   planAccepted(env, keys, now)  after POST /announce recorded posts: plan the delivery for each one (fills push_queue / push_held).
//   runCron(env, now, getFetch)   called by the cron trigger every minute: send one batch from push_queue.
// One rule decides both: sending must be READY (database, the sender keys and no pause). If it is not, nothing is planned either,
// so no message can wait in the queue without a sender (PLAN 31.7). Nothing here logs and no answer holds a push address, a key or a text.
//
// The kill switch is the variable PUSH_PAUSED. "true", "1", "yes" or "on" (any case) pauses everything. Change it in the Cloudflare dashboard
// (Workers, news-push, Settings, Variables) and it takes effect at the next call: no deploy is needed. Part 10 adds a button in the admin screen.

import { runPlan } from './plan.js';
import { runSender } from './sender.js';
import { loadVapid, cleanSubject } from './vapid.js';
import { cleanupDue, runCleanup } from './cleanup.js';
import { runFade, runLessCleanup } from './feedback.js';

export const PAUSE_WORDS = ['1', 'true', 'yes', 'on'];
export const PLAN_MAX_POSTS = 5; // posts planned in one announce call (the import guard keeps 2, so 5 is generous; the rest wait for no one and are counted)

/** true when the owner paused all sending (the kill switch). */
export const isPaused = (env) => PAUSE_WORDS.includes(String((env && env.PUSH_PAUSED) ?? '').trim().toLowerCase());

/**
 * Is sending ready? Returns { ready: true, vapid, subject }
 *                     or   { ready: false, reason: 'no_db' | 'paused' | 'no_keys' }.
 * The order matters: a missing database is reported first, then the pause, then the keys.
 */
export async function sendingState(env) {
  if (!env || !env.DB) return { ready: false, reason: 'no_db' };
  if (isPaused(env)) return { ready: false, reason: 'paused' };
  let keys = null;
  try {
    keys = await loadVapid(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  } catch {
    keys = null;
  }
  const subject = cleanSubject(env.VAPID_SUBJECT);
  if (!keys || !keys.ok || !subject) return { ready: false, reason: 'no_keys' };
  return { ready: true, vapid: keys.vapid, subject };
}

/**
 * Plans the delivery of the posts that /announce just recorded.
 * Returns { ran: false, reason } when sending is not ready (nothing is planned, nothing is queued),
 *      or { ran: true, planned, queued, held, errors, left } (counts only).
 * One post that fails does not stop the others: it is counted in `errors`. The post stays recorded, so nothing is announced twice.
 */
export async function planAccepted(env, keys, now) {
  const list = Array.isArray(keys) ? keys.filter((k) => typeof k === 'string' && k) : [];
  if (!list.length) return { ran: false, reason: 'no_posts' };
  const state = await sendingState(env);
  if (!state.ready) return { ran: false, reason: state.reason };
  const todo = list.slice(0, PLAN_MAX_POSTS);
  const out = { ran: true, planned: 0, queued: 0, held: 0, errors: 0, left: list.length - todo.length };
  for (const key of todo) {
    try {
      const r = await runPlan(env.DB, key, now);
      if (r && r.ok) {
        out.planned += 1;
        out.queued += Number(r.queued) || 0;
        out.held += Number(r.held) || 0;
      } else out.errors += 1;
    } catch {
      out.errors += 1;
    }
  }
  return out;
}

/**
 * One cron tick: send one batch. Never throws.
 * Returns { ok: true, skipped: reason } when sending is not ready (a missing database, a pause or missing keys is not an error of the tick),
 *      or { ok: false, reason: 'error' } when the database or the sender failed (the next tick tries again; messages that were claimed are taken back after their lease),
 *      or what runSender returns (counts only).
 */
export async function runCron(env, now, getFetch) {
  const state = await sendingState(env);
  if (!state.ready) return { ok: true, skipped: state.reason };
  try {
    return await runSender(env.DB, { vapid: state.vapid, subject: state.subject, fetch: getFetch, paused: false }, now);
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * The hourly clean-up (v0.83.0, part 7c). Called by the cron trigger with the time of the tick.
 * Runs only at the clean-up minute of each hour and only when there is a database. It does NOT depend on the kill switch or the sender keys:
 * old data is removed even while sending is paused. Never throws.
 * Returns { ran: false, reason: 'not_due' | 'no_db' } or { ran: true, ...counts } or { ran: true, ok: false, reason }.
 */
export async function runCleanupTick(env, now) {
  if (!env || !env.DB) return { ran: false, reason: 'no_db' };
  if (!cleanupDue(now)) return { ran: false, reason: 'not_due' };
  try {
    const r = await runCleanup(env.DB, now);
    // v0.99.0 (part 8b): the weekly fade of the learned weights runs in the same hourly tick (5 percent a week, feedback.js). It never throws.
    const f = await runFade(env.DB);
    // v0.100.0 (part 8c-1): old counted "Less like this" taps (30 days) and taps of readers that no longer exist are deleted in the same tick. It never throws.
    const l = await runLessCleanup(env.DB, now);
    return { ran: true, ...r, faded: f.ok ? f.faded : 0, lessDeleted: l.ok ? l.deleted : 0 };
  } catch {
    return { ran: true, ok: false, reason: 'error' };
  }
}
