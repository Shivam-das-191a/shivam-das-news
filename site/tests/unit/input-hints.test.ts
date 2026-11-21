import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkInputHints } from '../../scripts/input-hints-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkInputHints: good pages', () => {
  it('a page with none of these attributes passes', () => { expect(checkInputHints('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkInputHints(v as any).errors).toEqual(['the page is not text']);
  });
  it('real autocomplete field names pass', () => {
    for (const w of ['name', 'given-name', 'family-name', 'email', 'tel', 'username', 'new-password', 'current-password', 'one-time-code', 'street-address', 'address-line1', 'postal-code', 'country', 'cc-number', 'cc-exp', 'bday', 'url', 'organization', 'webauthn'])
      expect(checkInputHints(`<input type="text" autocomplete="${w}">`), w).toEqual(none);
  });
  it('on and off pass', () => { expect(checkInputHints('<form autocomplete="off"><input autocomplete="on"><input autocomplete="OFF"></form>')).toEqual(none); });
  it('modifiers with a field name pass', () => {
    expect(checkInputHints('<input autocomplete="shipping street-address"><input autocomplete="billing postal-code"><input autocomplete="section-blue shipping home tel"><input autocomplete="work email"><input autocomplete="mobile tel">')).toEqual(none);
  });
  it('a select and a textarea can carry autocomplete', () => { expect(checkInputHints('<select autocomplete="country"></select><textarea autocomplete="off"></textarea>')).toEqual(none); });
  it('real inputmode and enterkeyhint pass', () => {
    for (const v of ['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']) expect(checkInputHints(`<input inputmode="${v}">`), v).toEqual(none);
    for (const v of ['enter', 'done', 'go', 'next', 'previous', 'search', 'send']) expect(checkInputHints(`<input enterkeyhint="${v}">`), v).toEqual(none);
  });
  it('real autocapitalize, spellcheck and translate pass', () => {
    for (const v of ['off', 'none', 'on', 'sentences', 'words', 'characters']) expect(checkInputHints(`<textarea autocapitalize="${v}"></textarea>`), v).toEqual(none);
    expect(checkInputHints('<p spellcheck="true">a</p><p spellcheck="false">b</p><p spellcheck>c</p><p translate="no">d</p><p translate="yes">e</p><p translate="">f</p>')).toEqual(none);
  });
  it('real contenteditable and draggable pass', () => {
    expect(checkInputHints('<div contenteditable="true">a</div><div contenteditable="false">b</div><div contenteditable="plaintext-only">c</div><div contenteditable>d</div><img draggable="false" src="/a.jpg" alt="a"><a draggable="true" href="/x/">x</a>')).toEqual(none);
  });
  it('the wrap of a textarea passes', () => { expect(checkInputHints('<textarea wrap="hard"></textarea><textarea wrap="soft"></textarea><textarea wrap="off"></textarea>')).toEqual(none); });
  it('the case of a value does not matter', () => { expect(checkInputHints('<input autocomplete="EMAIL" inputmode="Numeric"><p spellcheck="TRUE">x</p>')).toEqual(none); });
  it('upper case tags and names, single quotes and no quotes are read', () => { expect(checkInputHints("<INPUT AUTOCOMPLETE='email' INPUTMODE=numeric>")).toEqual(none); });
  it('the wrap name on a tag that is not a textarea is not read', () => { expect(checkInputHints('<div wrap="zzz"></div><pre wrap="zzz">x</pre>')).toEqual(none); });
  it('autocomplete on a tag that cannot use it is not read', () => { expect(checkInputHints('<div autocomplete="zzz"></div><a href="/x/" autocomplete="zzz">x</a>')).toEqual(none); });
  it('names that only end with these words are not read', () => {
    expect(checkInputHints('<input data-inputmode="x" aria-autocomplete="list" xautocomplete="zzz" data-spellcheck="q" data-translate="no-way" data-draggable="q">')).toEqual(none);
  });
});

describe('checkInputHints: autocomplete errors', () => {
  it('a word that is not a real field name is an error', () => {
    expect(checkInputHints('<input autocomplete="firstname">').errors).toEqual(['a <input> has autocomplete word "firstname", which is not a real field name, so the browser cannot fill it; use a word such as name, given-name, email or tel']);
  });
  it('the usual wrong words are errors', () => {
    for (const w of ['e-mail', 'zip', 'phone', 'lastname', 'fname', 'password', 'street', 'city', 'tel-number', 'new_password']) expect(checkInputHints(`<input autocomplete="${w}">`).errors, w).toHaveLength(1);
  });
  it('an empty autocomplete is an error', () => {
    expect(checkInputHints('<input autocomplete="">').errors).toEqual(['a <input> has an empty autocomplete, which the browser ignores; use on, off or a real field name such as email']);
    expect(checkInputHints('<input autocomplete>').errors).toHaveLength(1);
  });
  it('a bad word next to good ones is found, and named', () => {
    expect(checkInputHints('<input autocomplete="shipping stret-address">').errors[0]).toContain('"stret-address"');
  });
  it('on or off joined with another word is an error', () => { expect(checkInputHints('<input autocomplete="off email">').errors).toHaveLength(1); });
  it('a bad word on a form, a select and a textarea is found', () => {
    expect(checkInputHints('<form autocomplete="maybe"></form>').errors).toHaveLength(1);
    expect(checkInputHints('<select autocomplete="nope"></select>').errors).toHaveLength(1);
    expect(checkInputHints('<textarea autocomplete="nope2"></textarea>').errors).toHaveLength(1);
  });
  it('a bare section word is an error', () => { expect(checkInputHints('<input autocomplete="section-">').errors).toHaveLength(1); });
  it('a very long word is cut in the message', () => { expect(checkInputHints('<input autocomplete="' + 'x'.repeat(300) + '">').errors[0].length).toBeLessThan(220); });
});

describe('checkInputHints: other value errors', () => {
  it('inputmode that is not real is an error', () => {
    expect(checkInputHints('<input inputmode="number">').errors).toEqual(['a <input> has inputmode="number", which is not a real value, so the browser ignores it; use none, text, tel, url, email, numeric, decimal or search']);
  });
  it('an empty inputmode is an error', () => { expect(checkInputHints('<input inputmode="">').errors).toHaveLength(1); });
  it('enterkeyhint that is not real is an error', () => { expect(checkInputHints('<input enterkeyhint="submit">').errors).toHaveLength(1); });
  it('autocapitalize that is not real is an error', () => { expect(checkInputHints('<textarea autocapitalize="sentence"></textarea>').errors).toHaveLength(1); });
  it('spellcheck that is not real is an error', () => {
    expect(checkInputHints('<p spellcheck="yes">x</p>').errors).toEqual(['a <p> has spellcheck="yes", which is not a real value, so the browser ignores it; use true or false']);
  });
  it('translate that is not real is an error', () => { expect(checkInputHints('<p translate="false">x</p>').errors).toHaveLength(1); });
  it('contenteditable that is not real is an error', () => { expect(checkInputHints('<div contenteditable="yes">x</div>').errors).toHaveLength(1); });
  it('draggable that is not real is an error, and an empty one too', () => {
    expect(checkInputHints('<img src="/a.jpg" alt="a" draggable="auto">').errors).toHaveLength(1);
    expect(checkInputHints('<img src="/a.jpg" alt="a" draggable>').errors).toHaveLength(1);
  });
  it('a textarea wrap that is not real is an error', () => { expect(checkInputHints('<textarea wrap="nowrap"></textarea>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkInputHints('<input inputmode="number"><input inputmode="number">').errors).toHaveLength(1); });
});

describe('checkInputHints: warnings', () => {
  it('autocomplete off on a password field is a warning', () => {
    const r = checkInputHints('<input type="password" autocomplete="off">');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a password field has autocomplete="off", so a password manager cannot fill it; use current-password or new-password']);
  });
  it('autocomplete off on a text field is fine', () => { expect(checkInputHints('<input type="text" autocomplete="off">')).toEqual(none); });
  it('a password field with a real word is fine', () => { expect(checkInputHints('<input type="password" autocomplete="current-password">')).toEqual(none); });
});

describe('checkInputHints: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<input autocomplete="zzz" inputmode="bad">\';</script><template><input inputmode="bad"></template><!-- <input autocomplete="zzz"> --><style>input[inputmode="bad"]{}</style>';
    expect(checkInputHints(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkInputHints('<main>' + '<input class="a b" type="email" autocomplete="email" inputmode="email" enterkeyhint="next" spellcheck="false">'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the contact form passes', () => { expect(checkInputHints(readFileSync('src/components/ContactForm.astro', 'utf8'))).toEqual(none); });
  it('the notifications page passes', () => { expect(checkInputHints(readFileSync('src/pages/notifications.astro', 'utf8'))).toEqual(none); });
  it('the contact form names its fields with real words', () => {
    const c = readFileSync('src/components/ContactForm.astro', 'utf8');
    expect(c).toMatch(/autocomplete="name"/);
    expect(c).toMatch(/autocomplete="email"/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'hints-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good form passes', () => { expect(run(FULL('<form method="post"><label>E <input type="email" autocomplete="email" inputmode="email"></label><button type="submit">Go</button></form>')).code).toBe(0); });
  it('a wrong autocomplete word stops the build and names the page', () => {
    const r = run(FULL('<form method="post"><label>N <input type="text" autocomplete="firstname"></label><button type="submit">Go</button></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <input> has autocomplete word "firstname"/);
  });
  it('a wrong inputmode stops the build', () => {
    const r = run(FULL('<form method="post"><label>N <input type="text" inputmode="number"></label><button type="submit">Go</button></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has inputmode="number"/);
  });
  it('autocomplete off on a password field is a warning, not an error', () => {
    const r = run(FULL('<form method="post"><label>P <input type="password" autocomplete="off"></label><button type="submit">Go</button></form>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*password manager/);
  });
});
