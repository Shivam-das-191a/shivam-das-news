// Auto image hosting, the result list screen (PLAN 34.3 steps 8 and 9, PLAN 34.5; Phase 3c Part 3c-6, v0.101.50).
// It only DRAWS the data of hosting-result.js (buildResultList) and calls the functions it is given. It does not fetch, save, read a token or touch GitHub.
//   hostingScreen({ list | run, onRetry, onConfirm, onReplace?, canEdit? })  -> { el, update(listOrRun), setBusy(bool), say(message, bad?) }
// opts:
//   list        the answer of buildResultList (or `run`, the answer of hostPost; then the list is built here)
//   onRetry     async ({ urls }) => void | { list?, message? }   the addresses to fetch again
//   onConfirm   async ({ urls, wholeHost }) => void | { list?, message? }   the writer confirmed the rights for these addresses (or the whole website)
//   onReplace   optional, ({ url }) => void   shows a "Show in post" button for a picture that must be replaced or removed
//   canEdit     false (default true) hides every button; the list is then only to read
// Rules: every text goes in as a TEXT node (h() in ui.js): an address is written by someone else and is never HTML. A button is disabled while its job runs, so a double
// click cannot send two requests. A callback that throws shows one plain sentence (plainMessage hides tokens) and the list stays as it was. Only a tone from TONES is
// written as an attribute. It writes nothing and nothing calls it yet, so the live site and the dashboard do not change.
import { h } from './ui.js';
import { buildResultList, TONES } from './hosting-result.js';
import { plainMessage } from './hosting-pipeline.js';

const TONE_SET = new Set(Object.values(TONES));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function asList(x) {
  if (x && typeof x === 'object' && Array.isArray(x.rows) && x.counts) return x; // already a list
  return buildResultList(x && typeof x === 'object' ? x : null);
}

export function hostingScreen(given) {
  const opts = given && typeof given === 'object' ? given : {};
  const canEdit = opts.canEdit !== false;
  let list = asList(opts.list || opts.run);
  let busy = false;

  const headline = h('p', { 'data-f': 'headline', role: 'status' });
  const notice = h('p', { class: 'mute', 'data-f': 'notice', hidden: true });
  const altNote = h('p', { class: 'mute', 'data-f': 'alt-note', hidden: true });
  const bar = h('div', { class: 'row-actions', 'data-f': 'bar' });
  const rowsBox = h('ul', { class: 'hosting-list', 'data-f': 'rows' });
  const status = h('p', { 'data-f': 'status', role: 'status', hidden: true });
  const el = h('div', { class: 'hosting-result' }, headline, notice, altNote, bar, rowsBox, status);

  const say = (message, bad) => {
    status.textContent = message || '';
    status.hidden = !message;
    status.className = bad ? 'bad' : '';
  };

  const lock = () => { for (const b of el.querySelectorAll('button')) b.disabled = busy; };

  // Runs one job: no second job while one runs; a throw becomes one plain sentence and the list stays.
  const run = async (job, arg) => {
    if (busy || typeof job !== 'function') return;
    busy = true; lock(); say('');
    try {
      const out = await job(arg);
      if (out && typeof out === 'object') {
        if (out.list || out.run) { list = asList(out.list || out.run); busy = false; draw(); }
        if (typeof out.message === 'string' && out.message) say(plainMessage({ message: out.message }));
      }
    } catch (e) {
      say(plainMessage(e), true);
    } finally {
      busy = false; lock();
    }
  };

  const button = (label, key, handler, extra) => h('button', { type: 'button', class: 'btn', 'data-f': key, ...(extra || {}), onclick: handler }, label);

  const rowEl = (r) => {
    const tone = TONE_SET.has(r.tone) ? r.tone : 'bad';
    const actions = [];
    if (canEdit && r.action === 'retry') actions.push(button('Retry', 'retry-one', () => run(opts.onRetry, { urls: [r.url] }), { 'data-url': r.url }));
    if (canEdit && r.action === 'confirm') {
      actions.push(button('Confirm', 'confirm-one', () => run(opts.onConfirm, { urls: [r.url], wholeHost: false }), { 'data-url': r.url }));
      if (r.host) actions.push(button(`Confirm all from ${r.host}`, 'confirm-host', () => run(opts.onConfirm, { urls: [r.url], wholeHost: true }), { 'data-url': r.url }));
    }
    if (canEdit && r.action === 'replace' && typeof opts.onReplace === 'function') {
      actions.push(button('Show in post', 'replace-one', () => { if (!busy) opts.onReplace({ url: r.url }); }, { 'data-url': r.url }));
    }
    return h('li', { class: `hosting-row ${tone}`, 'data-f': 'row', 'data-n': String(r.n), 'data-status': r.status, 'data-tone': tone, 'data-action': r.action },
      h('p', null, h('strong', { 'data-f': 'label' }, r.label), ' ', h('span', { 'data-f': 'url', title: r.url }, r.short)),
      r.text ? h('p', { 'data-f': 'text' }, r.text) : null,
      r.hint ? h('p', { class: 'mute', 'data-f': 'hint' }, r.hint) : null,
      actions.length ? h('div', { class: 'row-actions', 'data-f': 'actions' }, actions) : null);
  };

  function draw() {
    headline.textContent = list.headline;
    notice.textContent = list.notice || '';
    notice.hidden = !list.notice;
    altNote.textContent = list.autoAltCount > 0 ? `${plural(list.autoAltCount, 'picture has', 'pictures have')} alt text that was written for you. Please read it and correct it.` : '';
    altNote.hidden = list.autoAltCount === 0;
    bar.replaceChildren();
    if (canEdit && list.retry.length > 0) bar.append(button(`Retry ${plural(list.retry.length, 'picture', 'pictures')}`, 'retry-all', () => run(opts.onRetry, { urls: [...list.retry] })));
    if (canEdit && list.confirm.length > 0) bar.append(button(`Confirm ${plural(list.confirm.length, 'picture', 'pictures')}`, 'confirm-all', () => run(opts.onConfirm, { urls: [...list.confirm], wholeHost: false })));
    bar.hidden = bar.childNodes.length === 0;
    rowsBox.replaceChildren(...list.rows.map(rowEl));
    rowsBox.hidden = list.rows.length === 0;
    lock();
  }

  draw();
  return {
    el,
    update(next) { list = asList(next); say(''); draw(); },
    setBusy(on) { busy = on === true; lock(); },
    say(message, bad) { say(message ? plainMessage({ message: String(message) }) : '', bad === true); },
  };
}
