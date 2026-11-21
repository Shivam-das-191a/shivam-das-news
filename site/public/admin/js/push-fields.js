// v0.96.0 (push part 7e-2): the rules behind the "Notifications" box of the post editor (PLAN 31.5).
// Pure functions, no DOM, no network. The limits come from validate.js, which already equals the Worker limits.
import { PUSH_VALUES, PUSH_TITLE_MAX, PUSH_BODY_MAX } from './validate.js';

// Words shown to the editor for each value. `auto` is the default and is never written to the post file.
export const PUSH_CHOICES = [
  { value: 'auto', label: 'Auto (the system decides)', help: 'Normal stories. The system scores the story and picks readers by their choices.' },
  { value: 'off', label: 'Off (never notify)', help: 'No notification for this story, whatever its score.' },
  { value: 'force', label: 'Force (skip the importance part)', help: 'Use for a big story. It still obeys each reader: muted topics, pause, quiet hours and daily limit.' },
];

/** The value of the post, or `auto` when it is missing or not one of the three known values. */
export function pushValue(d) {
  return PUSH_VALUES.includes(d && d.push) ? d.push : 'auto';
}

const tidy = (t) => String(t ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Cuts a text to at most `max` characters at a word boundary, with an ellipsis inside the limit.
 * The same rule as `cutText` in workers/push/lib.js, so the preview shows what the Worker sends.
 */
export function cutWords(text, max) {
  const chars = [...tidy(text)];
  if (chars.length <= max) return chars.join('');
  let cut = chars.slice(0, max - 1).join('');
  const sp = cut.lastIndexOf(' ');
  if (chars[max - 1] !== ' ' && sp >= max * 0.5) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:.\u2013\u2014-]+$/, '') + '\u2026';
}

/** What the notification will say: the own text when written, else the headline and the description. */
export function pushPreview(d) {
  const title = tidy(d && d.pushTitle) || tidy(d && d.title) || 'Headline';
  const body = tidy(d && d.pushBody) || tidy(d && d.description);
  return { title: cutWords(title, PUSH_TITLE_MAX), body: cutWords(body, PUSH_BODY_MAX), ownTitle: !!tidy(d && d.pushTitle), ownBody: !!tidy(d && d.pushBody) };
}

/** Counter text such as "42/70". */
export const pushCount = (text, max) => `${[...String(text ?? '')].length}/${max}`;

/**
 * Cleans the three fields before the post is written: `auto` and empty texts are left out,
 * so a normal post file stays exactly as before. Returns a new object; the input is not changed.
 */
export function cleanPush(d) {
  const next = { ...d };
  if (pushValue(next) === 'auto') delete next.push;
  for (const k of ['pushTitle', 'pushBody']) {
    const v = typeof next[k] === 'string' ? next[k].trim() : '';
    if (v) next[k] = v; else delete next[k];
  }
  return next;
}

/** A short warning line for the box, or an empty text. */
export function pushNote(d, status) {
  const v = pushValue(d);
  if (v === 'off') return 'This story will not send a notification.';
  if (v === 'force' && d && d.robots && /noindex/.test(d.robots)) return 'Force does not help here: a page set to noindex never sends a notification.';
  if (v === 'force' && status !== 'published') return 'Force works only after the story is published and live.';
  return '';
}
