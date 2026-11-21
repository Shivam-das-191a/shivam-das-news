import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkFormControls } from '../../scripts/form-controls-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkFormControls: good pages', () => {
  it('a page with no form passes', () => { expect(checkFormControls('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkFormControls(v as any).errors).toEqual(['the page is not text']);
  });
  it('every real input type passes', () => {
    for (const t of ['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month', 'number', 'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week'])
      expect(checkFormControls(`<input type="${t}">`), t).toEqual(none);
  });
  it('an input with no type is a text box and passes', () => { expect(checkFormControls('<input name="q">')).toEqual(none); });
  it('the case of a value does not matter', () => {
    expect(checkFormControls('<input type="EMAIL"><button type="Submit">x</button>')).toEqual(none);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkFormControls("<INPUT TYPE='email' MAXLENGTH=100><BUTTON TYPE=button>x</BUTTON>")).toEqual(none);
  });
  it('a button with a type inside a form passes', () => {
    expect(checkFormControls('<form><button type="submit">Send</button><button type="button">No</button><button type="reset">Clear</button></form>')).toEqual(none);
  });
  it('a button with no type outside a form passes', () => { expect(checkFormControls('<button>Menu</button>')).toEqual(none); });
  it('a whole number length passes', () => {
    expect(checkFormControls('<input type="text" maxlength="100" minlength="0"><textarea maxlength="4000"></textarea>')).toEqual(none);
  });
  it('words that only start with the names are not read', () => {
    expect(checkFormControls('<inputs type="zzz"></inputs><buttons type="zzz"></buttons><formal><button>x</button></formal>')).toEqual(none);
  });
});

describe('checkFormControls: errors', () => {
  it('an input type that is not real is an error', () => {
    expect(checkFormControls('<input type="emial">').errors).toEqual([
      'an <input> has type="emial", which is not a real input type, so the browser shows a plain text box; use text, email, tel, url, number, password, checkbox, radio, hidden, submit or another real type',
    ]);
  });
  it('an empty input type is an error', () => {
    expect(checkFormControls('<input type="">').errors).toHaveLength(1);
    expect(checkFormControls('<input type>').errors).toHaveLength(1);
  });
  it('a button type that is not real is an error', () => {
    expect(checkFormControls('<button type="sumbit">x</button>').errors).toEqual([
      'a <button> has type="sumbit", which is not submit, reset or button, so the browser treats it as submit; write type="button" or type="submit"',
    ]);
  });
  it('an empty button type is an error, also outside a form', () => {
    expect(checkFormControls('<button type="">x</button>').errors).toHaveLength(1);
  });
  it('an input type that is only valid on a button is not allowed on a button', () => {
    expect(checkFormControls('<button type="text">x</button>').errors).toHaveLength(1);
  });
  it('a length that is not a whole number is an error on input and textarea', () => {
    for (const bad of ['abc', '1.5', '-1', '', '10px', '1e3']) {
      expect(checkFormControls(`<input maxlength="${bad}">`).errors, bad).toHaveLength(1);
      expect(checkFormControls(`<textarea minlength="${bad}"></textarea>`).errors, bad).toHaveLength(1);
    }
  });
  it('the length message names the tag and the attribute', () => {
    expect(checkFormControls('<textarea maxlength="lots"></textarea>').errors).toEqual([
      'an <textarea> has maxlength="lots", which is not a whole number, so the browser ignores it; write it like maxlength="200"',
    ]);
  });
  it('a very long value is cut in the message', () => { expect(checkFormControls('<input type="' + 'x'.repeat(300) + '">').errors[0].length).toBeLessThan(300); });
  it('the same message is not printed twice', () => { expect(checkFormControls('<input type="bad"><input type="bad">').errors).toHaveLength(1); });
});

describe('checkFormControls: warnings', () => {
  it('a button with no type inside a form is a warning', () => {
    const r = checkFormControls('<form><button>Send</button></form>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <button> inside a <form> has no type, so it submits the form; add type="submit" or type="button"']);
  });
  it('a button after the form is closed is not inside it', () => {
    expect(checkFormControls('<form><input></form><button>Menu</button>')).toEqual(none);
  });
  it('a button inside a nested or second form is still read', () => {
    expect(checkFormControls('<form></form><form><button>x</button></form>').warnings).toHaveLength(1);
  });
  it('a stray closing form tag does not break the count', () => {
    expect(checkFormControls('</form></form><form><button>x</button></form>').warnings).toHaveLength(1);
  });
});

describe('checkFormControls: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<input type="bad">\';</script><template><button type="bad"></button></template><!-- <input type="bad"> --><style>input[type="bad"]{}</style>';
    expect(checkFormControls(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkFormControls('<form>' + '<input type="text" maxlength="100"><button type="button">x</button>'.repeat(30000) + '</form>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the contact form uses real types and a typed send button', () => {
    const t = readFileSync('src/components/ContactForm.astro', 'utf8');
    expect(checkFormControls(t)).toEqual(none);
    expect(t).toMatch(/<button class="btn cf-send" type="submit">/);
  });
  it('the notifications page uses real types and typed buttons', () => {
    expect(checkFormControls(readFileSync('src/pages/notifications.astro', 'utf8'))).toEqual(none);
  });
  it('the header and the push prompt buttons have a type', () => {
    expect(checkFormControls(readFileSync('src/components/Header.astro', 'utf8'))).toEqual(none);
    expect(checkFormControls(readFileSync('src/components/PushPrompt.astro', 'utf8'))).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'formctl-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good form passes', () => {
    expect(run(FULL('<form><label>Email <input type="email" maxlength="120"></label><button type="submit">Send</button></form>')).code).toBe(0);
  });
  it('a mistyped input type stops the build and names the page', () => {
    const r = run(FULL('<label>Email <input type="emial"></label>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <input> has type="emial"/);
  });
  it('a mistyped button type stops the build', () => {
    const r = run(FULL('<button type="sumbit">Send</button>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/which is not submit, reset or button/);
  });
  it('a button with no type inside a form is a warning, not an error', () => {
    const r = run(FULL('<form><button>Send</button></form>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*has no type/);
  });
});
