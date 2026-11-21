// v0.84.0 (BOT_PROTECTION Part 5c): the "my own browser" switch. Plain JavaScript on purpose: the build puts this text inside every public page
// (see src/layouts/Base.astro) and the tests run the very same text. It touches the page only through `win`.
// The owner opens any public address of the site once with `?own-browser=on` at the end (for example your own site address followed by ?own-browser=on).
// The browser then keeps the mark `ownBrowser` = 1 in its own localStorage. From then on the ad loader (ads-client.js) loads no ad and the analytics beacon
// (beacon-client.js) counts no visit in THAT browser. `?own-browser=off` removes the mark. The word is cut from the address bar afterwards.
// Nothing is sent anywhere, no cookie, no secret: anyone can switch their own browser off from ads and counting, which only hurts themselves. Any failure is silent.
function ownBrowserSwitch(win) {
  var state = null;
  try {
    var query = String((win.location && win.location.search) || '');
    var m = /(?:^|[?&])own-browser=(on|off)(?:&|$)/.exec(query);
    if (!m) return null;
    state = m[1];
    if (state === 'on') win.localStorage.setItem('ownBrowser', '1');
    else win.localStorage.removeItem('ownBrowser');
  } catch (e) { return null; }
  try {
    var loc = win.location;
    var rest = String(loc.search || '').replace(/^\?/, '').split('&').filter(function (p) { return p && !/^own-browser=/.test(p); }).join('&');
    var clean = loc.pathname + (rest ? '?' + rest : '') + (loc.hash || '');
    if (win.history && typeof win.history.replaceState === 'function') win.history.replaceState(null, '', clean);
  } catch (e) { /* the address bar keeps the word: harmless */ }
  return state;
}
