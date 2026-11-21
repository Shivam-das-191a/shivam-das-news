// v0.84.0: the owner's own browser is never counted (BOT_PROTECTION 5c).
// v0.34.0 (Phase 6 part 3): browser side of the analytics beacon (PLAN 15, LOGICS 9; BUGS N1, N4). Plain JavaScript on purpose: the build puts this text
// inside article pages (see src/components/Beacon.astro) and the tests run the very same text. It touches the page only through `win`.
// What it sends (one small JSON text, under 1 KB): sid (random id for this tab session), pv (random id for this page view), path (no query, no hash),
// tz (time zone name), ref (the referrer address, the Worker keeps only its host), read (active seconds), scroll (deepest point, 0 to 100).
// Read time counts one second only while the tab is visible AND the reader did something in the last 30 seconds (BUGS N4), and stops at 3600.
// The same page view is sent again with a higher read time; the Worker keeps one row for it (BUGS N1). No cookie, no IP address, nothing leaves the page when the endpoint is empty.
// v0.74.0 (BOT_PROTECTION Part 3c): when the page starts it asks the Worker for a signed stamp (GET /stamp, the same address as /collect with /stamp at the end, one plain GET) and
// sends it back as `stamp` in every message. Until the stamp has arrived nothing is sent; the newest numbers go out the moment it arrives. If it cannot be had (3 tries, one a tick
// at most) the page sends nothing: the Worker would not count a message without it. `ref` is cut to 300 characters (the Worker keeps only its host).
// v0.76.0 (BOT_PROTECTION Part 4a): two more numbers in the message, `acted` (1 after a real touch, key press, click or a scroll of at least 20 percent of the way down; a made-up event from a script has isTrusted false and does not count)
// and `webdriver` (1 when navigator.webdriver is true). They are only flags: nothing is blocked here and no fingerprint is made (BOT_PROTECTION 7, last paragraph).
// v0.78.0 (BOT_PROTECTION Part 4b-2, the 5-second rule): the first message goes out only after 5 counted reader seconds (a visible tab and a reader who did something), not after 1.
// A background tab or a page left at once sends nothing. Later messages (every 30 seconds and on leaving) are as before.
// Article pages only. Any failure is silent: a broken beacon never touches the article.
function beaconClient(win, cfg) {
  var doc = win.document;
  if (!doc || !doc.body || doc.body.getAttribute('data-page-type') !== 'article' || !cfg || !cfg.endpoint) return null;
  // v0.84.0 (BOT_PROTECTION 5c): the owner's own browser (switch ?own-browser=on, see src/lib/own-browser.js) is never counted as a visit: no stamp request, no timer, no listener, no message.
  // A blocked or missing storage means "not the owner's browser".
  var mine = false;
  try { mine = win.localStorage.getItem('ownBrowser') === '1'; } catch (e) { mine = false; }
  if (mine) return null;

  var ACTIVE_SECONDS = 30, MAX_READ = 3600, EVERY = 30, FIRST = 5;
  var events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

  function randomId() {
    var out = '';
    try {
      var a = new Uint8Array(12);
      win.crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) out += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    } catch (e) {
      for (var j = 0; j < 24; j++) out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
  }

  function session() {
    var id = null;
    try { id = win.sessionStorage.getItem('anSid'); } catch (e) { id = null; }
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
    id = randomId();
    try { win.sessionStorage.setItem('anSid', id); } catch (e) { /* blocked storage: this page view only */ }
    return id;
  }

  function zone() {
    try { return win.Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }

  var stampUrl = String(cfg.endpoint).replace(/\/collect$/, '/stamp');
  var stamp = '', stampTries = 0, stampLoading = false;

  // Asks for the stamp. Silent on every failure; called again from send() while there is no stamp (at most 3 tries in all).
  function loadStamp() {
    if (stamp || stampLoading || stampTries >= 3 || typeof win.fetch !== 'function') return;
    stampLoading = true; stampTries += 1;
    try {
      win.fetch(stampUrl, { method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'cors' }).then(function (res) { return res.json(); }).then(function (j) {
        stampLoading = false;
        stamp = j && typeof j.stamp === 'string' ? j.stamp : '';
        if (stamp && read >= FIRST) send(); // only when the 5-second rule is met (the first message goes out after 5 reader seconds)
      }).then(null, function () { stampLoading = false; });
    } catch (e) { stampLoading = false; }
  }

  var sid = session();
  var pv = randomId();
  var read = 0, scroll = 0, idle = 0, sentRead = -1, sentScroll = -1, acted = 0, sentActed = -1;
  var webdriver = 0;
  // v0.97.0 (push part 7e-3): a push notification link ends with ?pn=1 (PLAN 31.5). Then the visit is told to the Worker as `pn: 1` (the source "Push notification"). Any other address sends no `pn` at all, so the message is the same as before.
  var fromPush = 0;
  try { fromPush = /(?:^|[?&])pn=1(?:&|#|$)/.test(String((win.location && win.location.search) || '')) ? 1 : 0; } catch (e) { fromPush = 0; }
  try { webdriver = win.navigator && win.navigator.webdriver === true ? 1 : 0; } catch (e) { webdriver = 0; }

  function depth() {
    try {
      var el = doc.documentElement;
      var total = Math.max(el.scrollHeight || 0, doc.body.scrollHeight || 0);
      var seen = (win.pageYOffset || el.scrollTop || 0) + (win.innerHeight || 0);
      if (total > 0) scroll = Math.max(scroll, Math.min(100, Math.round((seen / total) * 100)));
    } catch (e) { /* ignore */ }
  }

  function send() {
    if (read < FIRST) return; // the 5-second rule: a page left before 5 counted seconds is not a visit, so nothing goes out (not even on leaving)
    depth();
    if (read === sentRead && scroll === sentScroll && acted === sentActed) return;
    if (!stamp) { loadStamp(); return; } // nothing is marked as sent: the newest numbers go out when the stamp arrives
    sentRead = read; sentScroll = scroll; sentActed = acted;
    var msg = { sid: sid, pv: pv, path: win.location.pathname, tz: zone(), ref: String(doc.referrer || '').slice(0, 300), read: read, scroll: scroll, acted: acted, webdriver: webdriver, stamp: stamp };
    if (fromPush) msg.pn = 1;
    var body = JSON.stringify(msg);
    try {
      // A plain text body keeps this a "simple" request: no extra preflight round trip.
      if (win.navigator && typeof win.navigator.sendBeacon === 'function' && win.navigator.sendBeacon(cfg.endpoint, body)) return;
      if (typeof win.fetch === 'function') win.fetch(cfg.endpoint, { method: 'POST', body: body, keepalive: true, credentials: 'omit', mode: 'cors', headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    } catch (e) { /* silent */ }
  }

  // True when the page has been scrolled down at least 20 percent of the way it can go (the first screen alone is not a scroll).
  function scrolledEnough() {
    try {
      var el = doc.documentElement;
      var total = Math.max(el.scrollHeight || 0, doc.body.scrollHeight || 0);
      var room = total - (win.innerHeight || 0);
      var top = win.pageYOffset || el.scrollTop || 0;
      return room > 0 && top / room >= 0.2;
    } catch (e) { return false; }
  }

  // Every listed event keeps read time going (as before). A real one (not made up by a script) can also set `acted`.
  function touch(ev) {
    idle = 0;
    if (acted || (ev && ev.isTrusted === false)) return;
    var type = ev && ev.type;
    if (type === 'pointerdown' || type === 'keydown' || type === 'touchstart') acted = 1;
    else if (type === 'scroll' && scrolledEnough()) acted = 1;
  }
  for (var i = 0; i < events.length; i++) win.addEventListener(events[i], touch, { passive: true });

  // One tick = one second. Counts only a visible tab with a reader who did something in the last 30 seconds.
  function tick() {
    idle += 1;
    if (doc.visibilityState === 'hidden' || idle > ACTIVE_SECONDS || read >= MAX_READ) return;
    read += 1;
    if (read === FIRST || read % EVERY === 0) send();
  }
  loadStamp();
  var timer = win.setInterval(tick, 1000);

  function leave() { send(); }
  win.addEventListener('pagehide', leave);
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') leave(); });

  return { sid: sid, pv: pv, tick: tick, send: send, stop: function () { win.clearInterval(timer); } };
}
