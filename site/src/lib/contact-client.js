// v0.48.0 (Phase 7 part 6): browser side of the contact form (PLAN 16; BUGS N6). Plain JavaScript on purpose: the build puts this text
// inside the Contact page (see src/components/ContactForm.astro) and the tests run the very same text. It touches the page only through `win`.
// It sends one JSON text to the contact Worker: name, email, subject, message, website (the hidden trap, always empty for a person) and
// token (the Turnstile answer that the Turnstile script puts into the form). It checks the obvious mistakes first; the Worker checks again.
// v0.72.0 (BOT_PROTECTION Part 3a): the page asks the Worker for a signed fill-time stamp (GET /stamp, the same address as /contact with /stamp at the end)
// when it starts, and sends it back as `stamp`. The message goes as application/json. A new stamp is asked for after a sent message and when the Worker says `reload`.
// No cookie is used, nothing is kept in the browser, and nothing is sent until the person presses the button.
// Without JavaScript the form stays hidden and the page shows the email address instead.
function contactClient(win, cfg) {
  var doc = win.document;
  var form = doc && doc.querySelector ? doc.querySelector('form[data-contact]') : null;
  if (!form || !cfg || !cfg.endpoint) return null;

  var status = form.querySelector('[data-status]');
  var button = form.querySelector('button[type="submit"]');
  var busy = false;
  var stampUrl = String(cfg.endpoint).replace(/\/contact$/, '/stamp');
  var stamp = '';
  var stampWait = null;

  // Asks the Worker for a stamp. Never fails loudly: without a stamp the send step says so.
  function loadStamp() {
    stampWait = win.fetch(stampUrl).then(function (res) { return res.json(); }).then(function (j) {
      stamp = j && typeof j.stamp === 'string' ? j.stamp : '';
    }).then(null, function () { stamp = ''; });
    return stampWait;
  }
  var EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

  function val(name) {
    var el = form.elements[name];
    return el && typeof el.value === 'string' ? el.value : '';
  }

  function setStatus(text, isError) {
    if (!status) return;
    status.textContent = text;
    status.setAttribute('data-state', isError ? 'error' : 'ok');
  }

  function clearErrors() {
    var spans = form.querySelectorAll('[data-error]');
    for (var i = 0; i < spans.length; i++) spans[i].textContent = '';
    var bad = form.querySelectorAll('[aria-invalid]');
    for (var j = 0; j < bad.length; j++) bad[j].removeAttribute('aria-invalid');
  }

  function showError(field, text) {
    var span = form.querySelector('[data-error="' + field + '"]');
    var input = field === 'check' ? null : form.elements[field];
    if (span) span.textContent = text;
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      if (input.focus) input.focus();
    }
    if (!span && !input) setStatus(text, true);
  }

  function resetCheck() {
    try { if (win.turnstile && win.turnstile.reset) win.turnstile.reset(); } catch (e) { /* the check is asked again on the next page load */ }
  }

  function firstMistake(b) {
    if (!b.name.trim()) return ['name', 'Please write your name.'];
    if (!b.email.trim()) return ['email', 'Please write your email address.'];
    if (!EMAIL.test(b.email.trim())) return ['email', 'This email address does not look right.'];
    if (b.message.trim().length < 10) return ['message', 'Please write at least 10 characters.'];
    if (b.token.length < 10) return ['check', 'Please complete the check and send again.'];
    return null;
  }

  function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (busy) return;
    clearErrors();
    setStatus('', false);
    var body = { name: val('name'), email: val('email'), subject: val('subject'), message: val('message'), website: val('website'), token: val('cf-turnstile-response') };
    var m = firstMistake(body);
    if (m) { showError(m[0], m[1]); return; }

    busy = true;
    if (button) button.disabled = true;
    setStatus('Sending your message.', false);

    function done(timer) {
      if (timer !== null) win.clearTimeout(timer);
      busy = false;
      if (button) button.disabled = false;
    }

    function send() {
      if (!stamp) {
        setStatus('Your message was not sent. Please check your connection or write to us by email.', true);
        resetCheck();
        done(null);
        return;
      }
      body.stamp = stamp;
      var ctl = win.AbortController ? new win.AbortController() : null;
      var timer = ctl ? win.setTimeout(function () { ctl.abort(); }, 15000) : null;
      var init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      if (ctl) init.signal = ctl.signal;

      return win.fetch(cfg.endpoint, init).then(function (res) {
        return res.json().then(function (j) { return { status: res.status, json: j }; }, function () { return { status: res.status, json: null }; });
      }).then(function (r) {
        if (r.status === 200 && r.json && r.json.ok === true) {
          form.reset();
          setStatus('Thank you. Your message was sent. We cannot promise an answer to every message.', false);
          stamp = '';
          loadStamp();
        } else if (r.json && r.json.error && r.json.field) {
          setStatus('', false);
          showError(r.json.field, r.json.error);
        } else {
          setStatus(r.json && r.json.error ? r.json.error : 'Your message was not sent. Please write to us by email.', true);
          if (r.json && r.json.reload === true) { stamp = ''; loadStamp(); }
        }
        resetCheck();
      }, function () {
        setStatus('Your message was not sent. Please check your connection or write to us by email.', true);
        resetCheck();
      }).then(function () { done(timer); });
    }

    // The stamp was asked for when the page started. If it is not here yet, wait for it; if it did not come, ask once more.
    var ready = stamp ? Promise.resolve() : (stampWait || loadStamp());
    ready.then(function () { return stamp ? null : loadStamp(); }).then(send);
  }

  form.addEventListener('submit', submit);
  form.hidden = false;
  loadStamp();
  return { submit: submit };
}
