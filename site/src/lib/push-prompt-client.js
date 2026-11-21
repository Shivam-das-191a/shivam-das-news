// v0.56.0 (PLAN 31.2, push part 5a): browser side of the soft prompt. Plain JavaScript on purpose: the build puts this text inside article pages
// (see src/components/PushPrompt.astro) and the tests run the very same text. It touches the page only through `win`.
// Rules (all of them must hold, or the card stays hidden):
// - article pages only; the browser can do push; the permission is not "denied"; this browser is not already subscribed;
// - never on the very first visit (the first article this browser ever opened);
// - the reader has read at least 2 different articles, OR was active 45 seconds on this article and scrolled past 50 percent;
// - dismissed once: not again for 14 days; dismissed 3 times: never again;
// - the card only appears while its place is still below the visible screen, so nothing moves under the reader (BUGS A2, P-group);
// - any problem (blocked storage, an error) means NO card. The card never asks the browser for permission: the button only opens /notifications/.
// The reading list stays in this browser (localStorage, up to 20 article addresses); nothing here is sent anywhere.
function pushPromptClient(win, cfg) {
  var doc = win.document;
  var none = function () { return Promise.resolve(false); };
  if (!doc || !doc.body || doc.body.getAttribute('data-page-type') !== 'article' || typeof doc.querySelector !== 'function') return none;
  var card = doc.querySelector('[data-push-prompt]');
  if (!card) return none;

  var KEY = 'pushPrompt', DAY = 86400000, MIN_READS = 2, ACTIVE_SECONDS = 45, SCROLL_PCT = 50, DISMISS_DAYS = 14, DISMISS_MAX = 3, KEEP = 20;
  var nav = win.navigator || {};
  var now = function () { return Date.now(); };

  function load() {
    try {
      var raw = win.localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.v === 1 && Array.isArray(s.reads) && typeof s.dismissed === 'number') return { state: s, existed: true };
      }
    } catch (e) { /* blocked or damaged: treated as a first visit, so no card */ }
    return { state: { v: 1, reads: [], dismissed: 0, last: 0 }, existed: false };
  }
  function save(s) { try { win.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

  var ld = load();
  var state = ld.state;
  var existed = ld.existed;
  var path = String((win.location && win.location.pathname) || '');
  if (path && state.reads.indexOf(path) < 0) {
    state.reads.push(path);
    if (state.reads.length > KEEP) state.reads.shift();
  }
  save(state);

  var seconds = 0, pct = 0, lastAct = now(), shown = false, busy = false, timer = null;

  function allowed() {
    if (!existed) return false;
    if (state.dismissed >= DISMISS_MAX) return false;
    if (state.dismissed >= 1 && now() - (state.last || 0) < DISMISS_DAYS * DAY) return false;
    return state.reads.length >= MIN_READS || (seconds >= ACTIVE_SECONDS && pct >= SCROLL_PCT);
  }

  var envP = null;
  function envOk() {
    if (envP) return envP;
    envP = new Promise(function (resolve) {
      try {
        if (!('serviceWorker' in nav) || !('PushManager' in win) || !('Notification' in win)) return resolve(false);
        if (win.Notification.permission === 'denied') return resolve(false);
        nav.serviceWorker.getRegistration((cfg && cfg.worker) || '/push-sw.js').then(function (reg) {
          if (!reg || !reg.pushManager) return resolve(true);
          return reg.pushManager.getSubscription().then(function (sub) { resolve(!sub); });
        }).catch(function () { resolve(false); });
      } catch (e) { resolve(false); }
    });
    return envP;
  }

  function check() {
    if (shown || busy || !allowed()) return Promise.resolve(false);
    busy = true;
    return envOk().then(function (ok) {
      busy = false;
      if (!ok || shown || typeof card.getBoundingClientRect !== 'function') return false;
      if (!(card.getBoundingClientRect().top > (win.innerHeight || 0))) return false;
      card.removeAttribute('hidden');
      shown = true;
      if (timer !== null && typeof win.clearInterval === 'function') win.clearInterval(timer);
      return true;
    }, function () { busy = false; return false; });
  }

  function touch() {
    lastAct = now();
    var de = doc.documentElement;
    if (de && win.innerHeight) {
      var total = (de.scrollHeight || 0) - win.innerHeight;
      var y = win.scrollY || win.pageYOffset || 0;
      var p = total > 0 ? (y / total) * 100 : 100;
      if (p > pct) pct = p;
    }
  }
  function tick() {
    if (doc.visibilityState === 'hidden' || now() - lastAct > 30000) return;
    seconds += 1;
    check();
  }

  var dismiss = typeof card.querySelector === 'function' ? card.querySelector('[data-push-dismiss]') : null;
  if (dismiss && typeof dismiss.addEventListener === 'function') {
    dismiss.addEventListener('click', function () {
      state.dismissed += 1;
      state.last = now();
      save(state);
      card.setAttribute('hidden', '');
    });
  }
  var events = ['scroll', 'pointerdown', 'keydown', 'touchstart'];
  for (var i = 0; i < events.length; i++) win.addEventListener(events[i], touch, { passive: true });
  if (typeof win.setInterval === 'function') timer = win.setInterval(tick, 1000);
  return check;
}
