import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
// @ts-ignore plain JS rules of the Worker
import { cleanMessage } from '../../../workers/contact/lib.js';
import { contactPlan } from '../../src/lib/contact';
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';

// The browser file is plain text that the build puts into the Contact page. Here the very same text is run against a real (jsdom) page.
const contactClient: any = new Function(readFileSync('src/lib/contact-client.js', 'utf8') + '\nreturn contactClient;')();
const EP = 'https://contact.test/contact';
const read = (f: string) => readFileSync(f, 'utf8');

describe('contactPlan', () => {
  it('is off (null) with the default file, a missing file or empty values', () => {
    expect(contactPlan({ endpoint: '', turnstileSiteKey: '' })).toBeNull();
    expect(contactPlan({})).toBeNull();
    expect(contactPlan(null)).toBeNull();
    expect(contactPlan(undefined)).toBeNull();
    expect(contactPlan({ endpoint: '   ', turnstileSiteKey: ' ' })).toBeNull();
  });
  it('the shipped config is empty, so no page changes until the owner sets it', () => {
    expect(contactPlan(JSON.parse(read('tests/fixtures/shipped/config/contact.json')))).toBeNull();
  });
  it('returns the clean address and the key', () => {
    expect(contactPlan({ endpoint: ' https://news-contact.me.workers.dev/contact ', turnstileSiteKey: ' 0x4AAAAAAABkMYinukE8nzY ' })).toEqual({ endpoint: 'https://news-contact.me.workers.dev/contact', siteKey: '0x4AAAAAAABkMYinukE8nzY' });
  });
  it('stops the build when only one of the two values is set', () => {
    expect(() => contactPlan({ endpoint: EP, turnstileSiteKey: '' })).toThrow(/turnstileSiteKey is empty/);
    expect(() => contactPlan({ endpoint: '', turnstileSiteKey: '0x4AAAAAAABkMYinukE8nzY' })).toThrow(/endpoint is empty/);
  });
  it('stops the build on a wrong address, each with a plain reason', () => {
    const key = '0x4AAAAAAABkMYinukE8nzY';
    expect(() => contactPlan({ endpoint: 'http://c.test/contact', turnstileSiteKey: key })).toThrow(/https/);
    expect(() => contactPlan({ endpoint: 'not a url', turnstileSiteKey: key })).toThrow(/spaces|web address/);
    expect(() => contactPlan({ endpoint: 'https://localhost/contact', turnstileSiteKey: key })).toThrow(/host name/);
    expect(() => contactPlan({ endpoint: 'https://u:p@c.test/contact', turnstileSiteKey: key })).toThrow(/user name/);
    expect(() => contactPlan({ endpoint: 'https://c.test/collect', turnstileSiteKey: key })).toThrow(/must end with \/contact/);
    expect(() => contactPlan({ endpoint: 'https://c.test/contact"x', turnstileSiteKey: key })).toThrow(/unsafe/);
  });
  it('stops the build on a site key that looks wrong', () => {
    expect(() => contactPlan({ endpoint: EP, turnstileSiteKey: 'short' })).toThrow(/turnstileSiteKey must be/);
    expect(() => contactPlan({ endpoint: EP, turnstileSiteKey: 'has space in the key' })).toThrow(/turnstileSiteKey must be/);
    expect(() => contactPlan({ endpoint: EP, turnstileSiteKey: 'a"b<script>0123456789' })).toThrow(/turnstileSiteKey must be/);
  });
});

// The same fields, names and hidden trap as ContactForm.astro.
const FORM = `<!doctype html><html><body data-page-type="page"><form data-contact hidden novalidate>
<input name="name"><span data-error="name"></span>
<input name="email"><span data-error="email"></span>
<input name="subject"><span data-error="subject"></span>
<textarea name="message"></textarea><span data-error="message"></span>
<input name="website">
<input name="cf-turnstile-response"><span data-error="check"></span>
<button type="submit">Send message</button><p data-status></p></form></body></html>`;

const STAMP_EP = 'https://contact.test/stamp';
const STAMP = '1800000000000.' + 'a'.repeat(64);
function page(fetchImpl: (url: string, init: any) => Promise<any>, o: { turnstile?: any; stamp?: (n: number) => Promise<any> } = {}) {
  const dom = new JSDOM(FORM, { pretendToBeVisual: true });
  const w: any = dom.window;
  const calls: { url: string; init: any }[] = [];
  const stampCalls: { url: string; init: any }[] = [];
  const resets: number[] = [];
  // The stamp request is kept apart (stampCalls) so `calls` holds only the messages.
  w.fetch = (url: string, init: any) => {
    if (url === STAMP_EP) { stampCalls.push({ url, init }); return o.stamp ? o.stamp(stampCalls.length) : Promise.resolve({ ok: true, status: 200, json: async () => ({ stamp: STAMP }) }); }
    calls.push({ url, init });
    return fetchImpl(url, init);
  };
  if (o.turnstile !== null) w.turnstile = o.turnstile ?? { reset: () => resets.push(1) };
  const form = w.document.querySelector('form') as HTMLFormElement;
  const q = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
  const fill = (v: Record<string, string>) => { for (const [k, x] of Object.entries(v)) q(k).value = x; };
  const send = () => form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  const err = (f: string) => (w.document.querySelector(`[data-error="${f}"]`) as HTMLElement).textContent;
  const status = () => w.document.querySelector('[data-status]') as HTMLElement;
  const button = () => form.querySelector('button') as HTMLButtonElement;
  return { w, form, calls, stampCalls, resets, fill, send, err, status, button, q };
}
const ok = (obj: any, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => obj });
const good = { name: 'Asha Roy', email: 'asha@example.org', subject: 'A question', message: 'Hello, I have a question about your article.', 'cf-turnstile-response': 'turnstile-token-123456' };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('contact form in the browser', () => {
  it('does nothing without a form on the page or without an endpoint', () => {
    const none = new JSDOM('<!doctype html><body><p>no form</p></body>').window as any;
    expect(contactClient(none, { endpoint: EP })).toBeNull();
    const p = page(() => ok({ ok: true }));
    expect(contactClient(p.w, { endpoint: '' })).toBeNull();
    expect(contactClient(p.w, null)).toBeNull();
    expect(p.form.hidden).toBe(true);
    expect(p.calls).toHaveLength(0);
  });

  it('shows the form only when the script runs (hidden before)', () => {
    const p = page(() => ok({ ok: true }));
    expect(p.form.hidden).toBe(true);
    contactClient(p.w, { endpoint: EP });
    expect(p.form.hidden).toBe(false);
  });

  it('sends nothing until the button is pressed', () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    expect(p.calls).toHaveLength(0);
  });

  it('sends one JSON text with the fields the Worker expects, and the Worker rules accept it', async () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].url).toBe(EP);
    expect(p.calls[0].init.method).toBe('POST');
    expect(p.calls[0].init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(p.calls[0].init.body);
    expect(Object.keys(body).sort()).toEqual(['email', 'message', 'name', 'stamp', 'subject', 'token', 'website']);
    expect(body.stamp).toBe(STAMP);
    expect(body.token).toBe('turnstile-token-123456');
    expect(body.website).toBe('');
    const checked = cleanMessage(body);
    expect(checked.ok).toBe(true);
    expect(checked.message.email).toBe('asha@example.org');
  });

  it('on success: thanks the person, clears the form, asks for a new check and unlocks the button', async () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    expect(p.button().disabled).toBe(true);
    await flush();
    expect(p.status().textContent).toMatch(/Thank you/);
    expect(p.status().getAttribute('data-state')).toBe('ok');
    expect(p.q('message').value).toBe('');
    expect(p.q('name').value).toBe('');
    expect(p.resets).toHaveLength(1);
    expect(p.button().disabled).toBe(false);
  });

  it('does not send twice while a message is on its way', async () => {
    let release: any;
    const p = page(() => new Promise((r) => { release = () => r({ status: 200, json: async () => ({ ok: true }) }); }));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    p.send();
    p.send();
    await flush();
    expect(p.calls).toHaveLength(1);
    release();
    await flush();
    expect(p.button().disabled).toBe(false);
  });

  it('checks the obvious mistakes first and sends nothing', () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    p.fill({ ...good, name: '  ' });
    p.send();
    expect(p.err('name')).toMatch(/your name/);
    expect(p.q('name').getAttribute('aria-invalid')).toBe('true');
    p.fill({ ...good, email: 'nope' });
    p.send();
    expect(p.err('email')).toMatch(/does not look right/);
    expect(p.err('name')).toBe('');
    p.fill({ ...good, message: 'short' });
    p.send();
    expect(p.err('message')).toMatch(/at least 10/);
    p.fill({ ...good, 'cf-turnstile-response': '' });
    p.send();
    expect(p.err('check')).toMatch(/complete the check/);
    expect(p.calls).toHaveLength(0);
  });

  it('shows a field message from the Worker next to that field and asks for a new check', async () => {
    const p = page(() => ok({ error: 'Please send at most 2 links.', field: 'message' }, 400));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.err('message')).toBe('Please send at most 2 links.');
    expect(p.q('message').getAttribute('aria-invalid')).toBe('true');
    expect(p.q('message').value).toBe(good.message); // the text is kept, nothing is lost
    expect(p.resets).toHaveLength(1);
  });

  it('shows the Worker message for a rate limit or a server error, in the status line', async () => {
    const p = page(() => ok({ error: 'Too many messages. Please try again later.' }, 429));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.status().textContent).toBe('Too many messages. Please try again later.');
    expect(p.status().getAttribute('data-state')).toBe('error');
    expect(p.q('message').value).toBe(good.message);
  });

  it('on a network failure: says so plainly, keeps the text and unlocks the button', async () => {
    const p = page(() => Promise.reject(new Error('offline')));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.status().textContent).toMatch(/not sent/);
    expect(p.status().textContent).toMatch(/email/);
    expect(p.status().getAttribute('data-state')).toBe('error');
    expect(p.q('message').value).toBe(good.message);
    expect(p.button().disabled).toBe(false);
  });

  it('an answer that is not JSON gives the plain fallback message', async () => {
    const p = page(() => Promise.resolve({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.status().textContent).toMatch(/not sent/);
  });

  it('works when the Turnstile script did not load (no reset function)', async () => {
    const p = page(() => ok({ ok: true }), { turnstile: null });
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.status().textContent).toMatch(/Thank you/);
  });

  it('keeps the hidden field value for the Worker trap (a script that fills it is caught there)', async () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    p.fill({ ...good, website: 'http://spam.test' });
    p.send();
    await flush();
    const body = JSON.parse(p.calls[0].init.body);
    expect(cleanMessage(body)).toEqual({ ok: false, reason: 'bot' });
  });

  it('asks the Worker for a stamp when it starts (same address, /stamp), with a plain GET', async () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    await flush();
    expect(p.stampCalls).toHaveLength(1);
    expect(p.stampCalls[0].url).toBe('https://contact.test/stamp');
    expect(p.stampCalls[0].init).toBeUndefined();
    expect(p.calls).toHaveLength(0);
  });

  it('waits for a slow stamp and then sends it', async () => {
    let release: any;
    const p = page(() => ok({ ok: true }), { stamp: () => new Promise((r) => { release = () => r({ ok: true, status: 200, json: async () => ({ stamp: STAMP }) }); }) });
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    expect(p.calls).toHaveLength(0);
    release();
    await flush();
    expect(p.calls).toHaveLength(1);
    expect(JSON.parse(p.calls[0].init.body).stamp).toBe(STAMP);
  });

  it('asks once more when the first stamp did not come, and sends when the second one does', async () => {
    const p = page(() => ok({ ok: true }), { stamp: (n) => (n === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, status: 200, json: async () => ({ stamp: STAMP }) })) });
    contactClient(p.w, { endpoint: EP });
    await flush();
    p.fill(good);
    p.send();
    await flush();
    expect(p.stampCalls).toHaveLength(3); // the first failed, the second came, and a fresh one is asked for after the sent message
    expect(p.calls).toHaveLength(1);
    expect(p.status().textContent).toMatch(/Thank you/);
  });

  it('without any stamp it sends nothing, says so plainly and keeps the text', async () => {
    const p = page(() => ok({ ok: true }), { stamp: () => Promise.reject(new Error('offline')) });
    contactClient(p.w, { endpoint: EP });
    await flush();
    p.fill(good);
    p.send();
    await flush();
    expect(p.calls).toHaveLength(0);
    expect(p.status().textContent).toMatch(/not sent/);
    expect(p.status().getAttribute('data-state')).toBe('error');
    expect(p.q('message').value).toBe(good.message);
    expect(p.button().disabled).toBe(false);
    expect(p.resets).toHaveLength(1);
  });

  it('a stamp answer without a stamp text counts as no stamp', async () => {
    const p = page(() => ok({ ok: true }), { stamp: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ nothing: true }) }) });
    contactClient(p.w, { endpoint: EP });
    await flush();
    p.fill(good);
    p.send();
    await flush();
    expect(p.calls).toHaveLength(0);
  });

  it('asks for a new stamp after a sent message', async () => {
    const p = page(() => ok({ ok: true }));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    await flush();
    expect(p.stampCalls).toHaveLength(2);
  });

  it('asks for a new stamp when the Worker says reload, shows its message and keeps the text', async () => {
    const p = page(() => ok({ error: 'This page is old. Please reload it and try again.', reload: true }, 400));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    await flush();
    expect(p.status().textContent).toBe('This page is old. Please reload it and try again.');
    expect(p.stampCalls).toHaveLength(2);
    expect(p.q('message').value).toBe(good.message);
  });

  it('does not ask for a new stamp after an ordinary refusal (a quick second try must not be dropped as too fast)', async () => {
    const p = page(() => ok({ error: 'Too many messages. Please try again later.' }, 429));
    contactClient(p.w, { endpoint: EP });
    p.fill(good);
    p.send();
    await flush();
    await flush();
    expect(p.stampCalls).toHaveLength(1);
  });

  it('uses no cookie and no browser storage', () => {
    const code = read('src/lib/contact-client.js');
    expect(code).not.toMatch(/document\.cookie|localStorage|sessionStorage/);
  });
});

describe('ContactForm template and page wiring', () => {
  const tpl = read('src/components/ContactForm.astro');
  it('has every field the Worker reads, with labels, and the hidden trap', () => {
    for (const n of ['name', 'email', 'subject', 'message', 'website']) expect(tpl).toContain(`name="${n}"`);
    for (const id of ['cf-name', 'cf-email', 'cf-subject', 'cf-message', 'cf-website']) {
      expect(tpl).toContain(`id="${id}"`);
      expect(tpl).toContain(`for="${id}"`);
    }
    expect(tpl).toMatch(/class="cf-hp" aria-hidden="true"/);
    expect(tpl).toMatch(/tabindex="-1"/);
    expect(tpl).toMatch(/autocomplete="off"/);
  });
  it('is hidden until the script runs and says what to do without JavaScript', () => {
    expect(tpl).toMatch(/<form data-contact hidden novalidate>/);
    expect(tpl).toMatch(/<noscript>[^]*email[^]*<\/noscript>/);
  });
  it('loads Turnstile from Cloudflare and renders nothing without a plan', () => {
    expect(tpl).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(tpl).toMatch(/\{plan && \(/);
    expect(tpl).toContain('data-sitekey={plan.siteKey}');
  });
  it('has no ad code, no analytics code and no emoji (the build gate would stop it on a page)', () => {
    expect(tpl).not.toMatch(/data-ad-slot|ad-slot|data-ad-loader|adsClient|adsterra|pagead2|data-beacon|beaconClient/i);
    for (const f of ['src/components/ContactForm.astro', 'src/lib/contact-client.js', 'src/lib/contact.ts', 'config/contact.json']) expect(findEmoji(read(f))).toEqual([]);
  });
  it('the page template shows the form on the contact-us page only', () => {
    const t = read('src/pages/[year]/[month]/[day]/pages/[slug].astro');
    expect(t).toContain("import ContactForm from '../../../../../components/ContactForm.astro'");
    expect(t).toContain("page.data.permalink === 'contact-us' && <ContactForm />");
  });
  it('the form is not printed, inputs are 16 px and at least 44 px high', () => {
    const css = read('src/styles/global.css');
    expect(css).toMatch(/@media print\{\.cform\{display:none\}\}/);
    expect(css).toMatch(/\.cform input,\.cform textarea\{[^}]*min-height:44px[^}]*font:16px/);
  });
});
