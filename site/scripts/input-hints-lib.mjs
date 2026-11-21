// Part 8ae (POLISH, Accessibility and Mobile): the input hints and the global fixed-choice attributes of a built page hold a real value.
// A typo such as autocomplete="firstname" (the real word is given-name), inputmode="number" (numeric) or spellcheck="yes" (true) is never reported:
// the browser silently ignores it, so the phone keyboard is the wrong one, the password manager cannot fill the field and the reader types everything by hand.
// Pure function, no files, no network.
//   checkInputHints(html): { errors, warnings }
//   errors:   autocomplete (input, select, textarea, form): a word that is not on, off, a real field name or a real modifier (shipping, billing, home, work, mobile, fax, pager, section-x), or an empty value;
//             inputmode (none, text, tel, url, email, numeric, decimal, search); enterkeyhint (enter, done, go, next, previous, search, send);
//             autocapitalize (off, none, on, sentences, words, characters); spellcheck (true, false, or empty); translate (yes, no, or empty);
//             contenteditable (true, false, plaintext-only, or empty); draggable (true, false); wrap on a textarea (hard, soft, off)
//   warnings: autocomplete="off" on a password field (a password manager cannot fill it; use current-password or new-password)
// Left out on purpose, so there is no false alarm: the case of a value (TRUE is read as true); the same names written on other tags where they mean nothing for this check (wrap on a div);
//   names that only end with these words (data-inputmode, aria-autocomplete, xautocomplete); text inside script, style, template and comments.
// Why: forms and fields written by hand in a post or a custom block (PLAN 37) can carry these words, and the contact form and the notifications page of the site use autocomplete and inputmode.
const SKIP = /<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const FAST = /(?:^|[\s"'])(?:autocomplete|inputmode|enterkeyhint|autocapitalize|spellcheck|translate|contenteditable|draggable|wrap)(?=[\s=>/]|$)/i;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

const FIELD_NAMES = new Set(['name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix', 'nickname', 'username', 'new-password', 'current-password', 'one-time-code',
  'organization-title', 'organization', 'street-address', 'address-line1', 'address-line2', 'address-line3', 'address-level4', 'address-level3', 'address-level2', 'address-level1',
  'country', 'country-name', 'postal-code', 'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
  'transaction-currency', 'transaction-amount', 'language', 'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'url', 'photo', 'email', 'impp',
  'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local', 'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'webauthn']);
const MODIFIERS = new Set(['shipping', 'billing']);
const CONTACT_KIND = new Set(['home', 'work', 'mobile', 'fax', 'pager']);
const AC_TAGS = new Set(['input', 'select', 'textarea', 'form']);

// name -> { values, empty (an empty value is real), tags (null = every tag), exact }
const RULES = [
  { attr: 'inputmode', values: ['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search'] },
  { attr: 'enterkeyhint', values: ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'] },
  { attr: 'autocapitalize', values: ['off', 'none', 'on', 'sentences', 'words', 'characters'] },
  { attr: 'spellcheck', values: ['true', 'false'], empty: true },
  { attr: 'translate', values: ['yes', 'no'], empty: true },
  { attr: 'contenteditable', values: ['true', 'false', 'plaintext-only'], empty: true },
  { attr: 'draggable', values: ['true', 'false'] },
  { attr: 'wrap', values: ['hard', 'soft', 'off'], tags: ['textarea'] },
];
const list = (v) => (v.length === 2 ? `${v[0]} or ${v[1]}` : v.slice(0, -1).join(', ') + ' or ' + v[v.length - 1]);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

// Returns the first bad word of an autocomplete value, or null when the whole value is real.
function badAutocompleteWord(value) {
  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1 && (words[0] === 'on' || words[0] === 'off')) return null;
  for (const w of words) {
    if (FIELD_NAMES.has(w) || MODIFIERS.has(w) || CONTACT_KIND.has(w)) continue;
    if (/^section-\S+$/.test(w)) continue;
    return w;
  }
  return null;
}

export function checkInputHints(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    if (!FAST.test(m[2])) continue;
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    if (AC_TAGS.has(tag) && a.has('autocomplete')) {
      const raw = a.get('autocomplete');
      if (raw === '') errors.push(`a <${tag}> has an empty autocomplete, which the browser ignores; use on, off or a real field name such as email`);
      else {
        const bad = badAutocompleteWord(raw);
        if (bad !== null) errors.push(`a <${tag}> has autocomplete word "${short(bad)}", which is not a real field name, so the browser cannot fill it; use a word such as name, given-name, email or tel`);
        else if (raw.toLowerCase() === 'off' && tag === 'input' && (a.get('type') || '').toLowerCase() === 'password')
          warnings.push('a password field has autocomplete="off", so a password manager cannot fill it; use current-password or new-password');
      }
    }
    for (const r of RULES) {
      if (r.tags && !r.tags.includes(tag)) continue;
      if (!a.has(r.attr)) continue;
      const raw = a.get(r.attr);
      if (raw === '' && r.empty) continue;
      if (!r.values.includes(raw.toLowerCase()))
        errors.push(`a <${tag}> has ${r.attr}="${short(raw)}", which is not a real value, so the browser ignores it; use ${list(r.values)}`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
