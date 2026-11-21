// Part 8be (POLISH, Event handlers): the onclick="..." style attributes of a built page do what they say.
// An attribute written onclik or onlaod is not an event, so the browser keeps it as plain text and nothing ever runs; code with a missing bracket or quote
// never runs either. The browser shows no message to the reader and the dashboard preview does not run the page. A snippet pasted by hand (PLAN 37) or an old Blogger post can carry these.
// Pure function, no files, no network. The code is only compiled to find a syntax fault (new Function), it is never run.
//   checkHandlers(html): { errors, warnings }
//   errors:   an on... attribute that is a typo of a real event (onclik, onlaod, onsumbit); handler code that is not valid JavaScript (a bracket or a quote never closed, a stray word)
//   warnings: an empty handler (it does nothing); handler code that starts with javascript: (the word is only a label there)
// Read on: every start tag, every attribute whose name is on and letters; the case of the name is not read (onClick is onclick); the HTML characters &quot; &amp; &#39; in the value are decoded first.
// Left out on purpose, so there is no false alarm: an on... name that is not close to any real event (the list is open: an attribute such as online or a framework word may be fine);
//   a value that starts with { or holds a template expression (${...}); text inside comments, script, style and <template>; the code of the handler is not judged (only its syntax);
//   words such as x-on:click and @click (they are not on plus letters); a working inline handler (the public pages of the site allow inline code in their content policy,
//   and the Notifications page already uses onsubmit="return false").
// Why: nothing else reads event attributes; script-check-lib.mjs reads only script tags.
const SKIP = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const EVENTS = new Set(`onabort onafterprint onanimationcancel onanimationend onanimationiteration onanimationstart onauxclick onbeforeinput onbeforematch onbeforeprint
onbeforetoggle onbeforeunload onbegin onblur oncancel oncanplay oncanplaythrough onchange onclick onclose oncontentvisibilityautostatechange oncontextlost oncontextmenu
oncontextrestored oncopy oncuechange oncut ondblclick ondrag ondragend ondragenter ondragleave ondragover ondragstart ondrop ondurationchange onemptied onend onended onerror
onfocus onfocusin onfocusout onformdata onfullscreenchange onfullscreenerror ongotpointercapture onhashchange oninput oninvalid onkeydown onkeypress onkeyup onlanguagechange
onload onloadeddata onloadedmetadata onloadstart onlostpointercapture onmessage onmessageerror onmousedown onmouseenter onmouseleave onmousemove onmouseout onmouseover
onmouseup onmousewheel onoffline ononline onpagehide onpagereveal onpageshow onpageswap onpaste onpause onplay onplaying onpointercancel onpointerdown onpointerenter
onpointerleave onpointermove onpointerout onpointerover onpointerrawupdate onpointerup onpopstate onprogress onratechange onreadystatechange onrejectionhandled onrepeat
onreset onresize onscroll onscrollend onsecuritypolicyviolation onseeked onseeking onselect onselectionchange onselectstart onslotchange onstalled onstorage onsubmit
onsuspend ontimeupdate ontoggle ontouchcancel ontouchend ontouchmove ontouchstart ontransitioncancel ontransitionend ontransitionrun ontransitionstart onunhandledrejection
onunload onvolumechange onwaiting onwebkitanimationend onwebkitanimationiteration onwebkitanimationstart onwebkittransitionend onwheel onbeforecopy onbeforecut onbeforepaste
onbeforexrselect onpointerlockchange onpointerlockerror onsearch onshow onzoom onactivate onfocusin onerrorupdate onhelp onreadystatechange onbounce onfinish onstart`.split(/\s+/));

const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

/** Edit distance where swapping two neighbouring letters counts as one change (onlaod is a typo of onload). */
function distance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The real event this word is one change away from, or ''. */
function typoOf(word) {
  if (word.length < 6 || word.length > 40) return '';
  for (const w of EVENTS) {
    if (Math.abs(w.length - word.length) > 1) continue;
    if (distance(word, w) === 1) return w;
  }
  return '';
}

const decode = (v) => v.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&apos;|&#39;|&#x27;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');

/** The syntax fault of a piece of handler code in plain words, or '' when it compiles. The code is compiled, never run. */
function syntaxFault(code) {
  try {
    // eslint-disable-next-line no-new-func
    new Function('event', code);
    return '';
  } catch (e) {
    return String((e && e.message) || 'a syntax fault').replace(/\s+/g, ' ');
  }
}

export function checkHandlers(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const seen = new Set();
    for (const a of m[2].matchAll(ATTR)) {
      const name = a[1].toLowerCase();
      if (!/^on[a-z]+$/.test(name) || seen.has(name)) continue;
      seen.add(name);
      const where = `a <${tag}> has an ${name} attribute`;
      if (!EVENTS.has(name)) {
        const near = typoOf(name);
        if (near) errors.push(`${where}; it is not a real event, so nothing ever runs; it looks like a typo of ${near}`);
        continue;
      }
      const raw = a[2] ?? a[3] ?? a[4] ?? '';
      const code = decode(raw).trim();
      if (!code) { warnings.push(`${where} that is empty and does nothing; remove it`); continue; }
      if (code.startsWith('{') || code.includes('${')) continue; // a template expression
      const body = code.replace(/^javascript:/i, '');
      if (/^javascript:/i.test(code)) warnings.push(`${where} whose code starts with javascript:; the word is only a label there, remove it`);
      const fault = syntaxFault(body);
      if (fault) errors.push(`${where} whose code is not valid JavaScript (${short(fault)}), so it never runs; code: ${short(body)}`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
