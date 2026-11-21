// v0.61.0 (PLAN 31.1, push part 5c-4): the page logic of /notifications/. Plain browser code; the page script gives it the push client,
// and the tests give it a fake one. It never talks to the network itself: every call goes through `client` (src/lib/push-client.js).
// Core choices (5b): categories, "Breaking news from any category", alert level, daily limit, turn on, save, unsubscribe.
// Added in 5c-1: keywords to follow and keywords to mute (one box each, one keyword per line or separated by commas).
// Added in 5c-2: quiet hours (on or off, from and to) and "Let breaking news through during quiet hours". The time zone is the browser's (push-client sends it).
// Added in 5c-3: the digest (off, morning, evening, both, with the hours) and the pause (not paused, 1 day, 1 week, until the reader turns it back on).
// The pause is sent as `pause` next to the choices and only from a subscribed reader's Save; a timed pause that is running is shown as "Paused until ..." and is kept unless the reader picks something else.
// Added in 5c-4: authors to follow (shown only when the site has MIN_AUTHORS or more authors with published stories; the box group is marked data-n-authors).
// Added in 5c-5: the test notification. Added in 5c-6: the article bell button (topicHref, readTopic, applyTopic): the link carries the story's category and focus keyword,
// the page fills them into the form and saves NOTHING until the reader presses the button (PLAN 31.1). Part 5c is complete.
// Added in 8c-2 (v0.101.0): the offer "You tapped Less like this for Sports 3 times. Remove Sports?" (PLAN 31.8). The Worker names the categories (suggestRemove), the page shows one line and one button for each.
// The button saves ONLY that one change (the saved categories without it); it never touches other unsaved edits in the form, and the site never removes anything by itself.

export const LEVEL_CHOICES = [
  ['breaking_only', 'Breaking news only'],
  ['important', 'Important stories'],
  ['balanced', 'Balanced (recommended)'],
  ['everything', 'Everything I follow'],
];
export const LIMIT_CHOICES = [1, 2, 4, 8];
export const DEFAULT_LEVEL = 'balanced';
export const QUIET_DEFAULT = { start: '22:00', end: '07:00' }; // the Worker's default quiet hours (DEFAULT_QUIET in workers/push/prefs.js)
export const DIGEST_MODES = [
  ['off', 'No digest, one notification per story'],
  ['morning', 'A morning digest'],
  ['evening', 'An evening digest'],
  ['both', 'A morning and an evening digest'],
];
export const MORNING_HOURS = [4, 5, 6, 7, 8, 9, 10, 11]; // the same range as MORNING_RANGE in workers/push/prefs.js
export const EVENING_HOURS = [16, 17, 18, 19, 20, 21, 22, 23]; // EVENING_RANGE there
export const DIGEST_DEFAULT = { mode: 'off', morning: 8, evening: 20 };
export const PAUSE_CHOICES = [
  ['none', 'Not paused'],
  ['day', 'Pause for 1 day'],
  ['week', 'Pause for 1 week'],
  ['until_on', 'Pause until I turn notifications back on'],
];
export const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
export const MIN_AUTHORS = 2; // the Authors block is shown from this many authors with published stories (one author makes the block pointless)
export const MAX_AUTHORS = 60; // MAX_AUTHORS in workers/push/prefs.js
const AUTHOR_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An author id the Worker accepts (lower case letters, digits, single hyphens, up to 60 characters). The page lists only such authors. */
export const isAuthorSlug = (s) => typeof s === 'string' && s.length > 0 && s.length <= 60 && AUTHOR_SLUG.test(s);
export const MAX_KEYWORDS = 10; // same number as MAX_TERMS in workers/push/lib.js: for the follow list and, separately, for the mute list

export const MAX_KEYWORD_LENGTH = 40; // MAX_KEYWORD_LENGTH in workers/push/lib.js
export const MAX_KEYWORD_WORDS = 4; // MAX_KEYWORD_WORDS there
const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEYWORD_CHARS = /^[A-Za-z0-9 '\u2019-]+$/; // the characters the Worker's cleanKeyword accepts

/** A category id that can travel in a link (lower case letters, digits, single hyphens, up to 60 characters). */
const goodCategory = (c) => typeof c === 'string' && c.length > 0 && c.length <= 60 && CATEGORY_SLUG.test(c);
/** A keyword the Worker is likely to accept: spaces tidied, English letters, digits, spaces, hyphens and apostrophes only, 40 characters, 4 words. Returns the tidy keyword or ''. */
function goodKeyword(k) {
  if (typeof k !== 'string') return '';
  const w = k.replace(/\s+/g, ' ').trim();
  if (!w || w.length > MAX_KEYWORD_LENGTH || !KEYWORD_CHARS.test(w)) return '';
  return w.split(' ').length > MAX_KEYWORD_WORDS ? '' : w;
}

/** The address of the article bell button (PLAN 31.1): /notifications/ plus the story's category and focus keyword. A part that cannot be used is left out; with none left the plain page address is returned. */
export function topicHref(category, keyword) {
  const q = new URLSearchParams();
  if (goodCategory(category)) q.set('cat', category);
  const kw = goodKeyword(keyword);
  if (kw) q.set('kw', kw);
  const s = q.toString();
  return s ? `/notifications/?${s}` : '/notifications/';
}

/** Reads the topic from the address (the part after the question mark). Anything that is not a clean category id or a keyword the Worker may accept is ignored, so a made-up link can only fill a harmless choice. */
export function readTopic(search) {
  let q;
  try { q = new URLSearchParams(String(search ?? '')); } catch { return null; }
  const category = goodCategory(q.get('cat')) ? q.get('cat') : '';
  const keyword = goodKeyword(q.get('kw'));
  return category || keyword ? { category, keyword } : null;
}

/** Puts the topic into the form without saving anything. The category box is ticked only if the site has that category; the keyword is added to the follow box only if it is not there yet, not muted and the list has room. Returns { category, keyword }: true for what was really added. */
export function applyTopic(root, topic) {
  const out = { category: false, keyword: false };
  if (!topic || typeof topic !== 'object') return out;
  if (topic.category) {
    const box = Array.from(root.querySelectorAll('input[name="category"]')).find((i) => i.value === topic.category);
    if (box && !box.checked) { box.checked = true; out.category = true; }
  }
  const kw = goodKeyword(topic.keyword);
  const area = root.querySelector('textarea[name="keywords"]');
  if (kw && area) {
    const have = parseKeywordText(area.value);
    const mu = root.querySelector('textarea[name="muted"]');
    const muted = mu ? parseKeywordText(mu.value).map((x) => x.toLowerCase()) : [];
    const low = kw.toLowerCase();
    if (!have.some((x) => x.toLowerCase() === low) && !muted.includes(low) && have.length < MAX_KEYWORDS) {
      area.value = keywordText([...have, kw]);
      out.keyword = true;
    }
  }
  return out;
}

export const MESSAGES = {
  off: 'Notifications are not switched on for this site yet.',
  unsupported: 'This browser cannot show notifications from websites. Try Chrome, Edge, Firefox or Samsung Internet, or Safari on a Mac.',
  denied: 'Notifications are blocked for this site in your browser. To use them, allow notifications in the browser\'s site settings and open this page again.',
  dismissed: 'You did not answer the browser\'s question, so nothing was turned on.',
  needChoice: 'Please choose at least one category, one keyword, or Breaking news from any category.',
  tooManyFollow: `You can follow up to ${MAX_KEYWORDS} keywords. Please remove some.`,
  tooManyMute: `You can mute up to ${MAX_KEYWORDS} keywords. Please remove some.`,
  quietSame: 'Quiet hours cannot start and end at the same time. Turn them off instead.',
  digestBad: 'Please choose the digest times from the lists.',
  pausedForever: 'Notifications are paused until you turn them back on.',
  quietMissing: 'Please choose both quiet hour times.',
  sameWord: 'You cannot follow and mute the same keyword. Please remove it from one of the two boxes.',
  on: 'Notifications are on in this browser. You can change your choices here at any time.',
  created: 'Notifications are on. You will hear only about what you chose.',
  saved: 'Your choices are saved.',
  removed: 'Notifications are off and your data is deleted.',
  again: 'Please turn notifications on again.',
  error: 'Something went wrong. Please try again.',
  testSending: 'Sending the test notification.',
  testSent: 'Test sent. It should appear within a few seconds. If it does not, check the notification settings of your browser and your device.',
  topicNew: 'We filled in the topic of the story you were reading. Nothing is turned on until you press the button.',
  topicOn: 'We added the topic of the story you were reading. It is not saved until you press Save.',
  confirmOff: 'Press the button again within 6 seconds to turn notifications off and delete your data.',
};

/** The words of the offer for one category (PLAN 31.8). */
export const offerText = (name, count) => `You tapped Less like this for ${name} ${count} times. Remove ${name}?`;
export const offerDone = (name) => `${name} is removed. You will not get notifications about it any more.`;
export const OFFER_LAST = 'You cannot remove your last choice. Add another category, a keyword or Breaking news first, then try again.';

/** The name shown for a category: the name on the page (data-name of its tick box), or the id when the page has none. */
export function categoryName(root, category) {
  const box = [...root.querySelectorAll('input[name="category"]')].find((i) => i.value === category);
  const n = box && box.getAttribute('data-name');
  return n && n.trim() ? n.trim() : category;
}

/**
 * The offer list to show: only categories that the reader really follows (saved choices) and that this page knows as a tick box, with a count of 3 or more.
 * `saved` is the last choices the Worker confirmed. Returns [{ category, count }].
 */
export function offerItems(root, offer, saved) {
  const follows = new Set(saved && Array.isArray(saved.categories) ? saved.categories : []);
  const known = new Set([...root.querySelectorAll('input[name="category"]')].map((i) => i.value));
  const out = [];
  for (const o of Array.isArray(offer) ? offer : []) {
    const category = o && typeof o.category === 'string' ? o.category : '';
    const count = Number(o && o.count);
    if (category && follows.has(category) && known.has(category) && Number.isInteger(count) && count >= 3 && !out.some((x) => x.category === category)) out.push({ category, count });
  }
  return out;
}

/** Writes the offer lines into the offer box (text only, never HTML). With no lines the box is empty and hidden. */
export function renderOffer(root, items) {
  const box = root.querySelector('[data-n-suggest]');
  const list = root.querySelector('[data-n-suggest-list]');
  if (!box || !list) return 0;
  const doc = root.ownerDocument;
  list.textContent = '';
  for (const it of items) {
    const name = categoryName(root, it.category);
    const li = doc.createElement('li');
    const span = doc.createElement('span');
    span.textContent = offerText(name, it.count);
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.setAttribute('data-n-remove', it.category);
    btn.textContent = `Remove ${name}`;
    li.append(span, btn);
    list.append(li);
  }
  box.hidden = items.length === 0 || root.getAttribute('data-state') !== 'on';
  return items.length;
}

/** True for iPhone and iPad (also iPadOS that reports itself as a Mac). */
export function isIos(nav) {
  const ua = String((nav && nav.userAgent) || '');
  return /iPhone|iPad|iPod/.test(ua) || (nav && nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
}

/** Turns the text of a keyword box into a list: one keyword per line or separated by commas, spaces trimmed, empty parts dropped, the same keyword (any letter case) kept once. */
export function parseKeywordText(text) {
  const seen = new Set();
  const out = [];
  for (const part of String(text ?? '').split(/[\n\r,;]+/)) {
    const w = part.replace(/\s+/g, ' ').trim();
    const k = w.toLowerCase();
    if (!w || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

/** A list of keywords as the text of a box: one per line. */
export const keywordText = (list) => (Array.isArray(list) ? list.filter((x) => typeof x === 'string').join('\n') : '');

/** The first problem in the two keyword lists as a message from MESSAGES, or null. The Worker checks the words themselves (letters, length, too common). */
export function keywordProblem(p) {
  const f = Array.isArray(p.keywords) ? p.keywords : [];
  const m = Array.isArray(p.muted) ? p.muted : [];
  if (f.length > MAX_KEYWORDS) return MESSAGES.tooManyFollow;
  if (m.length > MAX_KEYWORDS) return MESSAGES.tooManyMute;
  const follow = new Set(f.map((x) => x.toLowerCase()));
  if (m.some((x) => follow.has(x.toLowerCase()))) return MESSAGES.sameWord;
  return null;
}

/** "Paused until 18 Nov, 14:30" for a time in milliseconds. Used in the pause list and the note under it. */
export function formatUntil(ms) {
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** The first problem in the digest as a message from MESSAGES, or null. Not sent means "keep". */
export function digestProblem(p) {
  const d = p.digest;
  if (d === undefined || d === null) return null;
  if (typeof d !== 'object' || !DIGEST_MODES.some(([v]) => v === d.mode)) return MESSAGES.digestBad;
  if (!MORNING_HOURS.includes(d.morning) || !EVENING_HOURS.includes(d.evening)) return MESSAGES.digestBad;
  return null;
}

/** Greys out the hour lists that the chosen digest does not use. Safe on a page without the boxes. */
export function syncDigest(root) {
  const m = root.querySelector('select[name="digestMode"]');
  if (!m) return;
  const am = root.querySelector('select[name="digestMorning"]');
  const ev = root.querySelector('select[name="digestEvening"]');
  if (am) am.disabled = !(m.value === 'morning' || m.value === 'both');
  if (ev) ev.disabled = !(m.value === 'evening' || m.value === 'both');
}

/** The pause to send: 'none', 'day', 'week' or 'until_on'; undefined when the page has no pause list or a running timed pause is kept. */
export function readPause(root) {
  const sel = root.querySelector('select[name="pause"]');
  if (!sel || !sel.value || sel.value === 'keep') return undefined;
  return sel.value;
}

/** Shows the saved pause: the list and the sentence under it. A timed pause that is running becomes the list's "Paused until ..." line. */
export function fillPause(root, pause) {
  const sel = root.querySelector('select[name="pause"]');
  if (!sel || !pause || typeof pause !== 'object') return;
  const keep = sel.querySelector('option[value="keep"]');
  const note = root.querySelector('[data-n-pause-note]');
  const setNote = (t) => { if (note) note.textContent = t; };
  if (keep) keep.hidden = true;
  if (pause.mode === 'timed' && Number(pause.until) > 0 && keep) {
    const text = `Paused until ${formatUntil(pause.until)}`;
    keep.textContent = text;
    keep.hidden = false;
    sel.value = 'keep';
    setNote(`${text}. Pick "Not paused" and save to start again now.`);
  } else if (pause.mode === 'until_on') {
    sel.value = 'until_on';
    setNote(MESSAGES.pausedForever);
  } else {
    sel.value = 'none';
    setNote('');
  }
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The first problem in the quiet hours as a message from MESSAGES, or null. A missing quiet value (not sent, or null) is fine: it means "keep" or "off". */
export function quietProblem(p) {
  const q = p.quiet;
  if (q === undefined || q === null) return null;
  if (typeof q !== 'object' || !CLOCK.test(String(q.start)) || !CLOCK.test(String(q.end))) return MESSAGES.quietMissing;
  return q.start === q.end ? MESSAGES.quietSame : null;
}

/** Greys out the two times while quiet hours are off. Safe on a page without the boxes. */
export function syncQuiet(root) {
  const on = root.querySelector('input[name="quietOn"]');
  if (!on) return;
  root.querySelectorAll('input[name="quietStart"], input[name="quietEnd"]').forEach((i) => { i.disabled = !on.checked; });
}

/** The reader's choices from the form: { categories, level, dailyLimit, breakingAll } and, when the page has them, { keywords, muted } { quiet, breakingInQuiet } { digest } and, when the page has the Authors block, { authors }. dailyLimit is null for "automatic". */
export function readForm(root) {
  const categories = Array.from(root.querySelectorAll('input[name="category"]'))
    .filter((i) => i.checked)
    .map((i) => i.value);
  const lvl = root.querySelector('input[name="level"]:checked');
  const lim = root.querySelector('select[name="dailyLimit"]');
  const br = root.querySelector('input[name="breakingAll"]');
  const n = lim && lim.value ? Number(lim.value) : null;
  const out = {
    categories,
    level: lvl ? lvl.value : DEFAULT_LEVEL,
    dailyLimit: n && LIMIT_CHOICES.includes(n) ? n : null,
    breakingAll: br ? br.checked : true,
  };
  // A box that is not on the page is not sent, so the Worker keeps what it has saved.
  const kw = root.querySelector('textarea[name="keywords"]');
  const mu = root.querySelector('textarea[name="muted"]');
  if (kw) out.keywords = parseKeywordText(kw.value);
  if (mu) out.muted = parseKeywordText(mu.value);
  // Quiet hours: off is null, on is { start, end } as HH:MM. Without the boxes nothing is sent and the Worker keeps its saved choice.
  const qOn = root.querySelector('input[name="quietOn"]');
  const qs = root.querySelector('input[name="quietStart"]');
  const qe = root.querySelector('input[name="quietEnd"]');
  if (qOn && qs && qe) out.quiet = qOn.checked ? { start: qs.value, end: qe.value } : null;
  const bq = root.querySelector('input[name="breakingInQuiet"]');
  if (bq) out.breakingInQuiet = bq.checked;
  const dm = root.querySelector('select[name="digestMode"]');
  const dmo = root.querySelector('select[name="digestMorning"]');
  const dev = root.querySelector('select[name="digestEvening"]');
  if (dm && dmo && dev) out.digest = { mode: dm.value, morning: Number(dmo.value), evening: Number(dev.value) };
  // Without the Authors block nothing is sent and the Worker keeps the saved authors.
  if (root.querySelector('[data-n-authors]')) {
    out.authors = Array.from(root.querySelectorAll('input[name="author"]')).filter((i) => i.checked).map((i) => i.value);
  }
  return out;
}

/** Puts saved choices into the form. A category that no longer exists on the site is ignored here (the Worker keeps it until the next save). */
export function fillForm(root, prefs) {
  if (!prefs || typeof prefs !== 'object') return;
  const cats = new Set(Array.isArray(prefs.categories) ? prefs.categories : []);
  root.querySelectorAll('input[name="category"]').forEach((i) => { i.checked = cats.has(i.value); });
  root.querySelectorAll('input[name="level"]').forEach((i) => { i.checked = i.value === prefs.level; });
  const lim = root.querySelector('select[name="dailyLimit"]');
  if (lim) lim.value = prefs.dailyLimit ? String(prefs.dailyLimit) : '';
  const br = root.querySelector('input[name="breakingAll"]');
  if (br && typeof prefs.breakingAll === 'boolean') br.checked = prefs.breakingAll;
  const kw = root.querySelector('textarea[name="keywords"]');
  if (kw && Array.isArray(prefs.keywords)) kw.value = keywordText(prefs.keywords);
  const mu = root.querySelector('textarea[name="muted"]');
  if (mu && Array.isArray(prefs.muted)) mu.value = keywordText(prefs.muted);
  const qOn = root.querySelector('input[name="quietOn"]');
  const qs = root.querySelector('input[name="quietStart"]');
  const qe = root.querySelector('input[name="quietEnd"]');
  if (qOn && 'quiet' in prefs) {
    qOn.checked = !!prefs.quiet;
    if (prefs.quiet && qs && qe) { qs.value = prefs.quiet.start; qe.value = prefs.quiet.end; }
  }
  const bq = root.querySelector('input[name="breakingInQuiet"]');
  if (bq && typeof prefs.breakingInQuiet === 'boolean') bq.checked = prefs.breakingInQuiet;
  syncQuiet(root);
  const dm = root.querySelector('select[name="digestMode"]');
  const dmo = root.querySelector('select[name="digestMorning"]');
  const dev = root.querySelector('select[name="digestEvening"]');
  if (dm && prefs.digest && typeof prefs.digest === 'object') {
    dm.value = prefs.digest.mode;
    if (dmo) dmo.value = String(prefs.digest.morning);
    if (dev) dev.value = String(prefs.digest.evening);
  }
  syncDigest(root);
  if (root.querySelector('[data-n-authors]') && Array.isArray(prefs.authors)) {
    const set = new Set(prefs.authors);
    root.querySelectorAll('input[name="author"]').forEach((i) => { i.checked = set.has(i.value); });
  }
  fillPause(root, prefs.pause);
}

/** At least one category, one keyword or breaking news (the Worker checks it too, PLAN 31.1). */
export const hasChoice = (p) => p.categories.length > 0 || (Array.isArray(p.keywords) && p.keywords.length > 0) || p.breakingAll === true;

export async function initNotificationsPage({ root, cfg, client, win = window }) {
  const $ = (s) => root.querySelector(s);
  const msg = $('[data-n-msg]');
  const form = $('[data-n-form]');
  const bOn = $('[data-n-on]');
  const bSave = $('[data-n-save]');
  const bOff = $('[data-n-off]');
  const bTest = $('[data-n-test]');
  const testNote = $('[data-n-test-note]');
  const ios = $('[data-n-ios]');
  const pauseBox = $('[data-n-pause]');
  const busyEls = [bOn, bSave, bOff, bTest].filter(Boolean);
  let offArmed = null;
  let saved = null; // the last choices the Worker confirmed (the offer button changes only these)
  let offer = []; // the last offer list from the Worker
  const offerBox = $('[data-n-suggest]');

  const say = (text, bad = false) => {
    if (!msg) return;
    msg.textContent = text;
    msg.setAttribute('data-bad', bad ? '1' : '0');
  };
  const show = (el, yes) => { if (el) el.hidden = !yes; };
  const busy = (yes) => busyEls.forEach((b) => { b.disabled = yes; });
  // Buttons: "on" while this browser is not subscribed, "save" and "off" while it is.
  const mode = (m) => {
    root.setAttribute('data-state', m);
    show(form, m === 'new' || m === 'on');
    show(bOn, m === 'new');
    show(bSave, m === 'on');
    show(bOff, m === 'on' || m === 'blocked-on');
    show(bTest, m === 'on');
    show(testNote, m === 'on');
    show(ios, m === 'ios');
    show(pauseBox, m === 'on');
    if (m !== 'on' && offerBox) offerBox.hidden = true;
  };
  const refreshOffer = () => renderOffer(root, offerItems(root, offer, saved));
  const fail = (r) => {
    if (r && r.reason === 'denied') { mode('blocked'); say(MESSAGES.denied, true); return; }
    if (r && r.reason === 'dismissed') { say(MESSAGES.dismissed); return; }
    if (r && (r.reason === 'resubscribe' || r.reason === 'not_subscribed')) { mode('new'); say(MESSAGES.again, true); return; }
    say((r && r.error) || MESSAGES.error, true);
  };

  let st;
  try { st = await client.status({ cfg }); } catch { st = null; }
  if (!st || !st.enabled) { mode('off'); say(MESSAGES.off); return { state: 'off' }; }
  if (!st.supported) {
    if (isIos(win.navigator)) { mode('ios'); say('On an iPhone or iPad, notifications work only after you add this site to the Home Screen.'); return { state: 'ios' }; }
    mode('unsupported'); say(MESSAGES.unsupported); return { state: 'unsupported' };
  }
  if (st.permission === 'denied') {
    if (st.hasState) mode('blocked-on'); else mode('blocked');
    say(MESSAGES.denied, true);
    return { state: 'blocked' };
  }

  let state = 'new';
  let failed = false;
  if (st.subscribed && st.hasState) {
    const r = await client.getPrefs({ cfg });
    if (r && r.ok) { fillForm(root, r.prefs); state = 'on'; mode('on'); say(MESSAGES.on); saved = r.prefs; offer = Array.isArray(r.suggestRemove) ? r.suggestRemove : []; refreshOffer(); }
    else { mode('new'); fail(r); state = 'new'; failed = true; }
  } else {
    mode('new');
    const none = root.querySelector('input[name="level"]:checked');
    if (!none) { const d = root.querySelector(`input[name="level"][value="${DEFAULT_LEVEL}"]`); if (d) d.checked = true; }
    say('Choose what you want to hear about, then press the button.');
  }

  // 5c-6: the article bell button brings a topic in the address. It is only filled in, never saved. A failed load keeps its own message.
  if (!failed) {
    const topic = readTopic(win.location && win.location.search);
    if (topic) {
      const added = applyTopic(root, topic);
      if (added.category || added.keyword) say(state === 'on' ? MESSAGES.topicOn : MESSAGES.topicNew);
    }
  }

  const quietBox = $('input[name="quietOn"]');
  if (quietBox) quietBox.addEventListener('change', () => syncQuiet(root));
  syncQuiet(root);
  const digestSel = $('select[name="digestMode"]');
  if (digestSel) digestSel.addEventListener('change', () => syncDigest(root));
  syncDigest(root);

  const guard = async (fn) => {
    busy(true);
    try { await fn(); } catch { say(MESSAGES.error, true); } finally { busy(false); }
  };

  if (bOn) bOn.addEventListener('click', () => guard(async () => {
    const prefs = readForm(root);
    if (!hasChoice(prefs)) { say(MESSAGES.needChoice, true); return; }
    const kp = keywordProblem(prefs) || quietProblem(prefs) || digestProblem(prefs);
    if (kp) { say(kp, true); return; }
    const r = await client.enable({ cfg, prefs });
    if (r && r.ok) { fillForm(root, r.prefs); mode('on'); say(r.created === false ? MESSAGES.on : MESSAGES.created); saved = r.prefs; offer = []; refreshOffer(); return; }
    fail(r);
  }));

  if (bSave) bSave.addEventListener('click', () => guard(async () => {
    const prefs = readForm(root);
    if (!hasChoice(prefs)) { say(MESSAGES.needChoice, true); return; }
    const kp = keywordProblem(prefs) || quietProblem(prefs) || digestProblem(prefs);
    if (kp) { say(kp, true); return; }
    const args = { cfg, prefs };
    const pause = readPause(root);
    if (pause !== undefined) args.pause = pause;
    const r = await client.savePrefs(args);
    if (r && r.ok) { fillForm(root, r.prefs); say(MESSAGES.saved); saved = r.prefs; refreshOffer(); return; }
    fail(r);
  }));

  if (bTest) bTest.addEventListener('click', () => guard(async () => {
    say(MESSAGES.testSending);
    const r = await client.sendTest({ cfg });
    if (r && r.ok) { say(MESSAGES.testSent); return; }
    fail(r);
  }));

  if (bOff) bOff.addEventListener('click', () => guard(async () => {
    if (!offArmed) {
      offArmed = win.setTimeout(() => { offArmed = null; }, 6000);
      say(MESSAGES.confirmOff);
      return;
    }
    win.clearTimeout(offArmed);
    offArmed = null;
    const r = await client.disable({ cfg });
    if (r && r.ok) { mode('new'); say(MESSAGES.removed); saved = null; offer = []; renderOffer(root, []); return; }
    fail(r);
  }));

  // 8c-2: the one-tap button of the offer. It saves only the saved categories without this one; other edits in the form are not saved and not lost.
  let removing = false;
  if (offerBox) offerBox.addEventListener('click', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-n-remove]') : null;
    if (!t || !offerBox.contains(t)) return;
    if (removing) return; // a second tap while the first is still being saved does nothing
    removing = true;
    const category = t.getAttribute('data-n-remove');
    guard(async () => {
      if (!saved || !Array.isArray(saved.categories) || !saved.categories.includes(category)) { refreshOffer(); return; }
      const rest = saved.categories.filter((c) => c !== category);
      const keeps = rest.length > 0 || (Array.isArray(saved.keywords) && saved.keywords.length > 0) || saved.breakingAll === true;
      if (!keeps) { say(OFFER_LAST, true); return; }
      const name = categoryName(root, category);
      const r = await client.savePrefs({ cfg, prefs: { categories: rest } });
      if (r && r.ok) {
        saved = r.prefs;
        offer = offer.filter((o) => o.category !== category);
        // Only the box of this category changes in the form; whatever else the reader typed stays.
        const box = [...root.querySelectorAll('input[name="category"]')].find((i) => i.value === category);
        if (box) box.checked = false;
        refreshOffer();
        say(offerDone(name));
        return;
      }
      fail(r);
    }).finally(() => { removing = false; });
  });

  return { state };
}
