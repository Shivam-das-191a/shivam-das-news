// v0.84.0: the owner's own browser loads nothing (BOT_PROTECTION 5c).
// v0.20.0 (native banner v0.22.0, smartlink v0.23.0, AdSense unit v0.24.0, consent v0.25.0, ad choices v0.26.0, answer expires v0.27.0, days from the settings v0.28.0, bar text from the settings v0.30.0, button words v0.31.0): browser side of the ad loader. Plain JavaScript on purpose: the build puts this text inside article pages
// (see src/components/AdLoader.astro) and the tests run the very same text. It touches the page only through `win`.
// Rules: article pages only (PLAN 29.1); nothing loads before ONE REAL event of the reader: a press, a key or a touch, or a scroll (v0.81.0, BOT_PROTECTION 8). The idle time no longer starts the loader, and an event made up by a script (isTrusted false) does not count;
// any failure of the country check means NO ads (BUGS A1); popunder only from the 2nd article view of a session and once (BUGS A3).
// v0.25.0: where the Worker says `consent: true` (EU, EEA, UK, Switzerland, unknown country) NO ad loads until the reader clicks Accept.
// v0.27.0: a saved answer (yes or no) is valid for 180 days, then the bar asks again. The number comes from `consentDays` in config/ad-loader.json (30 to 365, v0.28.0); 180 when it is missing.
// v0.26.0: those readers also get a small "Ad choices" button under the article text to change their answer later.
// No answer, a missing `consent` field or a blocked storage all count as "consent needed". AdSense never loads for those readers (Google needs its own certified consent tool for that).
function adsClient(win, cfg) {
  var doc = win.document;
  var none = function () { return Promise.resolve([]); };
  if (!doc || !doc.body || doc.body.getAttribute('data-page-type') !== 'article' || cfg.hideAll) return none;
  // v0.84.0 (BOT_PROTECTION 5c): the owner's own browser (switch ?own-browser=on, see src/lib/own-browser.js) never loads an ad, never asks the geo Worker and adds no listener.
  // A blocked or missing storage means "not the owner's browser".
  var mine = false;
  try { mine = win.localStorage.getItem('ownBrowser') === '1'; } catch (e) { mine = false; }
  if (mine) return none;

  var events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  var ran = null;

  function store(op, key, value) {
    try { return op === 'get' ? win.sessionStorage.getItem(key) : win.sessionStorage.setItem(key, value); } catch (e) { return null; }
  }

  function put(src, name, cors) {
    var s = doc.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute('data-ad-format', name);
    s.setAttribute('data-cfasync', 'false');
    if (cors) s.setAttribute('crossorigin', 'anonymous');
    doc.body.appendChild(s);
  }

  // v0.22.0: one native banner box after paragraph N of the article text. Only when there are more than N paragraphs
  // (never at the very end) and the place is still below the visible screen, so nothing moves under the reader (BUGS A2).
  // The box has a fixed minimum height and a plain "Advertisement" label. Returns true when the box and its script were added.
  function putNative(nb) {
    if (!nb || !nb.script || !nb.containerId || typeof doc.querySelectorAll !== 'function') return false;
    var paras = doc.querySelectorAll('.content > p');
    var n = nb.afterParagraph || 3;
    if (!paras || paras.length <= n) return false;
    var anchor = paras[n - 1];
    if (!anchor || !anchor.parentNode || typeof anchor.getBoundingClientRect !== 'function') return false;
    var below = anchor.getBoundingClientRect().bottom > (win.innerHeight || 0);
    if (!below) return false;
    var box = doc.createElement('div');
    box.setAttribute('data-ad-slot', 'native');
    box.setAttribute('style', 'min-height:250px;margin:1.5rem 0;clear:both');
    var label = doc.createElement('p');
    label.setAttribute('style', 'margin:0 0 .25rem;font-size:.75rem;opacity:.6');
    label.textContent = 'Advertisement';
    var slot = doc.createElement('div');
    slot.setAttribute('id', nb.containerId);
    box.appendChild(label);
    box.appendChild(slot);
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    put(nb.script, 'nativeBanner');
    return true;
  }

  // v0.24.0: one Google AdSense in-article unit after paragraph N of the article text. Same safety rules as the native banner:
  // only when there are more than N paragraphs (never at the very end) and the place is still below the visible screen (BUGS A2).
  // The box has a fixed minimum height and an "Advertisement" label. The script address is Google's own and fixed here; only the
  // publisher id (from ads.json) and the slot number come from the settings. Returns true when the box and its script were added.
  function putAdsense(as) {
    if (!as || !as.client || !as.slot || typeof doc.querySelectorAll !== 'function') return false;
    var paras = doc.querySelectorAll('.content > p');
    var n = as.afterParagraph || 5;
    if (!paras || paras.length <= n) return false;
    var anchor = paras[n - 1];
    if (!anchor || !anchor.parentNode || typeof anchor.getBoundingClientRect !== 'function') return false;
    if (!(anchor.getBoundingClientRect().bottom > (win.innerHeight || 0))) return false;
    var box = doc.createElement('div');
    box.setAttribute('data-ad-slot', 'adsense');
    box.setAttribute('style', 'min-height:280px;margin:1.5rem 0;clear:both');
    var label = doc.createElement('p');
    label.setAttribute('style', 'margin:0 0 .25rem;font-size:.75rem;opacity:.6');
    label.textContent = 'Advertisement';
    var ins = doc.createElement('ins');
    ins.setAttribute('class', 'adsbygoogle');
    ins.setAttribute('style', 'display:block');
    ins.setAttribute('data-ad-client', as.client);
    ins.setAttribute('data-ad-slot', as.slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    box.appendChild(label);
    box.appendChild(ins);
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    put('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(as.client), 'adsense', true);
    try { win.adsbygoogle = win.adsbygoogle || []; win.adsbygoogle.push({}); } catch (e) { /* the unit simply stays empty */ }
    return true;
  }

  // v0.55.0: the smartlink opens only when the reader clicks a picture inside the article (the top picture or a picture in the text),
  // and only ONE time per session (and one time per page). No text link, no script, no automatic redirect. The click is the reader's own,
  // so the new tab is allowed by the browser. Returns true when the listener was added.
  function putSmartlink(url) {
    if (!url || typeof doc.addEventListener !== 'function') return false;
    if (store('get', 'adSmartDone') === '1') return false;
    var done = false;
    function onClick(e) {
      if (done) return;
      var t = e && e.target;
      if (!t || String(t.tagName || '').toLowerCase() !== 'img') return;
      if (typeof t.closest === 'function' && !t.closest('.content, .hero')) return;
      done = true;
      store('set', 'adSmartDone', '1');
      try { doc.removeEventListener('click', onClick, true); } catch (err) { /* ignore */ }
      try { win.open(url, '_blank', 'noopener,noreferrer'); } catch (err) { /* ignore */ }
    }
    doc.addEventListener('click', onClick, true);
    return true;
  }

  // v0.26.0: the reader can change the answer later. A small "Ad choices" button under the article text (after the smartlink line, if there is one).
  // It is added only for readers who had to consent, and only when the end of the text is still below the visible screen, so nothing moves under the reader (BUGS A2).
  // A click opens the same bar again. When the answer changes the page is reloaded, so the new answer is used at once (ads that were added cannot be taken back).
  var accepted = false;
  function reload() { try { win.location.reload(); } catch (e) { /* ignore */ } }
  function putChoices() {
    if (typeof doc.querySelector !== 'function' || doc.querySelector('[data-ad-choices]')) return false;
    var content = doc.querySelector('.content');
    if (!content || !content.parentNode || typeof content.getBoundingClientRect !== 'function') return false;
    if (!(content.getBoundingClientRect().bottom > (win.innerHeight || 0))) return false;
    var box = doc.createElement('p');
    box.setAttribute('data-ad-choices', '1');
    box.setAttribute('style', 'margin:.5rem 0;font-size:.875rem');
    var b = doc.createElement('button');
    b.setAttribute('type', 'button');
    b.setAttribute('style', 'min-height:44px;min-width:44px;padding:0;border:0;background:none;color:inherit;font:inherit;text-decoration:underline;cursor:pointer');
    b.textContent = word('consentChoices', 'Ad choices');
    b.addEventListener('click', function () {
      if (doc.querySelector('[data-ad-consent]')) return;
      askConsent().then(function (yes) { if (yes !== accepted) reload(); });
    });
    box.appendChild(b);
    var after = doc.querySelector('[data-ad-slot="smartlink"]') || content;
    after.parentNode.insertBefore(box, after.nextSibling);
    return true;
  }

  // { ads, consent }. ads is true only when the Worker answers { ads: true } in time. consent is false only when the Worker says exactly `consent: false`.
  function geoAnswer() {
    var no = { ads: false, consent: true };
    if (typeof win.fetch !== 'function') return Promise.resolve(no);
    var ctl = typeof win.AbortController === 'function' ? new win.AbortController() : null;
    var opts = { cache: 'no-store', credentials: 'omit', mode: 'cors' };
    if (ctl) opts.signal = ctl.signal;
    var ask;
    try {
      ask = win.fetch(cfg.geoUrl, opts)
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) { return j && j.ads === true ? { ads: true, consent: j.consent !== false } : no; })
        .catch(function () { return no; });
    } catch (e) { return Promise.resolve(no); }
    var limit = new Promise(function (resolve) {
      win.setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) { /* ignore */ } } resolve(no); }, cfg.timeoutMs || 3000);
    });
    return Promise.race([ask, limit]);
  }

  // v0.25.0: the reader's saved choice lives in this browser only. A blocked storage gives null, so the question is asked again.
  // v0.27.0: it is saved as "yes|<time>" or "no|<time>" and is valid for 180 days. Anything else (an old value without a time, a time in the future,
  // a time older than the limit, a broken text) counts as "no answer", so the bar asks again.
  function choice(op, value) {
    try { return op === 'get' ? win.localStorage.getItem('adConsent') : win.localStorage.setItem('adConsent', value); } catch (e) { return null; }
  }
  function now() { try { return win.Date.now(); } catch (e) { return Date.now(); } }
  function savedAnswer() {
    var v = choice('get');
    if (typeof v !== 'string') return null;
    var p = v.split('|');
    if (p.length !== 2 || (p[0] !== 'yes' && p[0] !== 'no') || !/^\d{10,15}$/.test(p[1])) return null;
    var age = now() - parseInt(p[1], 10);
    var days = typeof cfg.consentDays === 'number' && cfg.consentDays > 0 ? cfg.consentDays : 180;
    return age >= 0 && age <= days * 86400000 ? p[0] : null;
  }

  // v0.31.0: the words on the buttons come from the settings (consentAccept, consentDecline, consentChoices) when they are 2 to 24 characters; plain text only.
  function word(key, fallback) {
    var v = typeof cfg[key] === 'string' ? cfg[key].trim() : '';
    return v.length >= 2 && v.length <= 24 ? v : fallback;
  }

  // v0.25.0: a small bar fixed to the bottom of the screen (it never pushes the text, CSS.md section 9). Two equal buttons, each at least 44 px high.
  // Resolves true for Accept and false for No thanks. The choice is saved; the bar is removed.
  function askConsent() {
    return new Promise(function (resolve) {
      var bar = doc.createElement('div');
      bar.setAttribute('data-ad-consent', '1');
      bar.setAttribute('role', 'dialog');
      bar.setAttribute('aria-label', 'Advertising choice');
      bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;padding:.75rem 1rem calc(.75rem + env(safe-area-inset-bottom,0px));background:#14171a;color:#fff;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif');
      var text = doc.createElement('p');
      text.setAttribute('style', 'margin:0;flex:1 1 18rem');
      // v0.30.0: the owner's own sentence (config/ad-loader.json, consentText) when there is one; set as plain text, never as HTML.
      var own = typeof cfg.consentText === 'string' ? cfg.consentText.trim() : '';
      text.textContent = own && own.length <= 300 ? own : 'We would like to show ads from our partners next to this article. They may use cookies or similar technology. Without your yes, no ad is loaded.';
      var row = doc.createElement('div');
      row.setAttribute('style', 'display:flex;gap:.5rem');
      function button(label, yes, filled) {
        var b = doc.createElement('button');
        b.setAttribute('type', 'button');
        b.setAttribute('style', 'min-height:44px;min-width:44px;padding:0 1rem;border-radius:8px;font:inherit;cursor:pointer;border:1px solid #fff;' + (filled ? 'background:#fff;color:#14171a' : 'background:transparent;color:#fff'));
        b.textContent = label;
        b.addEventListener('click', function () {
          choice('set', (yes ? 'yes' : 'no') + '|' + now());
          if (bar.parentNode) bar.parentNode.removeChild(bar);
          resolve(yes);
        });
        return b;
      }
      row.appendChild(button(word('consentAccept', 'Accept'), true, true));
      row.appendChild(button(word('consentDecline', 'No thanks'), false, false));
      bar.appendChild(text);
      bar.appendChild(row);
      doc.body.appendChild(bar);
    });
  }

  // v0.81.0: only a real event starts the loader. An event made up by a script has isTrusted false and is ignored (the same rule as the beacon's `acted`).
  // Honest limit: the browser's own scroll restore after a reload is a real scroll event, so it counts.
  function onAction(ev) {
    if (ev && ev.isTrusted === false) return;
    run();
  }

  function stop() {
    for (var i = 0; i < events.length; i++) win.removeEventListener(events[i], onAction);
  }

  // Runs once. Resolves with the list of formats that were added (empty when nothing was added).
  function run() {
    if (ran) return ran;
    stop();
    var views = (parseInt(store('get', 'adViews'), 10) || 0) + 1;
    store('set', 'adViews', String(views));
    // `limited` is true for a reader who had to give consent: no AdSense unit for them (v0.25.0).
    function place(limited) {
      var shown = [];
      if (cfg.socialBar) { put(cfg.socialBar, 'socialBar'); shown.push('socialBar'); }
      if (putNative(cfg.nativeBanner)) shown.push('nativeBanner');
      if (!limited && putAdsense(cfg.adsense)) shown.push('adsense');
      if (putSmartlink(cfg.smartlink)) shown.push('smartlink');
      if (cfg.popunder && !cfg.hidePopunder && views >= 2 && store('get', 'adPopShown') !== '1') {
        store('set', 'adPopShown', '1');
        put(cfg.popunder, 'popunder');
        shown.push('popunder');
      }
      return shown;
    }
    ran = geoAnswer().then(function (g) {
      if (!g.ads) return [];
      if (!g.consent) return place(false);
      var saved = savedAnswer();
      if (saved === 'no') { putChoices(); return []; }
      if (saved === 'yes') { accepted = true; var shown = place(true); putChoices(); return shown; }
      return askConsent().then(function (yes) {
        var shown = [];
        if (yes) { accepted = true; shown = place(true); }
        putChoices();
        return shown;
      });
    });
    return ran;
  }

  for (var i = 0; i < events.length; i++) win.addEventListener(events[i], onAction, { passive: true });
  // v0.81.0: no idle timer any more (BOT_PROTECTION 8, rule 1): a reader who does nothing gets no ad. `cfg.idleMs` is still in the settings plan but nothing reads it.
  return run;
}
