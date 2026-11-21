import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error plain JS module without types
import { FIELDS, checkPublisher, buildPages, planWrites, featuresFrom } from '../../scripts/required-pages-lib.mjs';
// @ts-expect-error plain JS module without types
import { findIconGlyphs } from '../../scripts/no-emoji-lib.mjs';
import { pageKind } from '../../src/lib/schema';

const read = (f: string) => readFileSync(f, 'utf8');
const NOW = new Date('2026-11-15T06:00:00Z');

const good = {
  legalName: 'Sample Media Private Limited',
  ownerName: 'Asha Rao',
  email: 'news@media.in',
  address: '12 Main Road, Kolkata 700001, West Bengal',
  country: 'India',
  foundedYear: '2026',
  fundingSummary: 'The site is paid for by advertising shown inside articles.',
};

describe('config/publisher.json (shipped)', () => {
  it('lists every field, all empty (no placeholder owner details)', () => {
    const cfg = JSON.parse(read('tests/fixtures/shipped/config/publisher.json'));
    expect(Object.keys(cfg).sort()).toEqual(FIELDS.map((f: { key: string }) => f.key).sort());
    for (const v of Object.values(cfg)) expect(v).toBe('');
  });
  it('stops page making with a plain list of what is missing', () => {
    const cfg = JSON.parse(read('tests/fixtures/shipped/config/publisher.json'));
    expect(checkPublisher(cfg, NOW).missing).toHaveLength(FIELDS.length);
    expect(() => buildPages({ publisher: cfg, siteName: 'Shivam Das News', now: NOW })).toThrow(/not ready[\s\S]*missing: legalName/);
  });
});

describe('checkPublisher', () => {
  it('accepts good details', () => {
    expect(checkPublisher(good, NOW)).toEqual({ missing: [], bad: [] });
  });
  it('treats blanks, spaces and a missing object as missing', () => {
    expect(checkPublisher(undefined, NOW).missing).toHaveLength(FIELDS.length);
    expect(checkPublisher({ ...good, email: '   ' }, NOW).missing).toHaveLength(1);
  });
  it('refuses wrong values', () => {
    const bad = (o: object) => checkPublisher({ ...good, ...o }, NOW).bad.join(' | ');
    expect(bad({ email: 'not-an-email' })).toMatch(/email is not a valid/);
    expect(bad({ foundedYear: '26' })).toMatch(/four digit/);
    expect(bad({ foundedYear: '2027' })).toMatch(/four digit/);
    expect(bad({ foundedYear: '1850' })).toMatch(/four digit/);
    expect(bad({ address: 'line one\nline two' })).toMatch(/one line/);
    expect(bad({ ownerName: '<b>Asha</b>' })).toMatch(/< or >/);
    expect(bad({ ownerName: 'Asha {{x}}' })).toMatch(/\{ or \}/);
    expect(bad({ country: 'x'.repeat(81) })).toMatch(/longer than 80/);
    expect(bad({ legalName: 'Lorem ipsum Ltd' })).toMatch(/placeholder/);
    expect(bad({ email: 'a@example.com' })).toMatch(/placeholder/);
  });
  it('refuses an emoji (PLAN 29.3)', () => {
    const smile = String.fromCodePoint(0x1f600);
    expect(checkPublisher({ ...good, fundingSummary: `Ads ${smile}` }, NOW).bad.join(' ')).toMatch(/emoji/);
  });
  it('accepts Bengali and other scripts in names and addresses', () => {
    expect(checkPublisher({ ...good, ownerName: 'শিবম দাস', address: 'কলকাতা ৭০০০০১' }, NOW).bad).toEqual([]);
  });
});

describe('buildPages', () => {
  const pages = buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW });
  const by = (slug: string) => pages.find((p: { slug: string }) => p.slug === slug)!;

  it('makes the twelve required pages with the plan slugs', () => {
    expect(pages.map((p: { slug: string }) => p.slug)).toEqual([
      'about-us', 'contact-us', 'editorial-policy', 'corrections-policy', 'ownership-and-funding', 'privacy-policy', 'terms-and-conditions', 'cookie-policy', 'disclaimer', 'dmca', 'advertise-with-us', 'affiliate-disclosure',
    ]);
    for (const p of pages) expect(p.file).toBe(`${p.slug}.md`);
  });
  it('writes front matter the pages collection accepts (title, permalink, date, description, status)', () => {
    for (const p of pages) {
      const fm = p.markdown.split('---')[1];
      const get = (k: string) => (fm.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1];
      expect(JSON.parse(get('title')).length).toBeGreaterThanOrEqual(2);
      expect(JSON.parse(get('permalink'))).toBe(p.slug);
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(get('date')).toBe('2026-11-15T06:00:00.000Z');
      const desc = JSON.parse(get('description'));
      expect(desc.length).toBeGreaterThan(20);
      expect(desc.length).toBeLessThanOrEqual(160);
      expect(get('status')).toBe('draft');
    }
  });
  it('is a draft unless published is asked for', () => {
    const pub = buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW, status: 'published' });
    expect(pub.every((p: { markdown: string }) => /^status: published$/m.test(p.markdown))).toBe(true);
    expect(() => buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW, status: 'live' })).toThrow(/status/);
  });
  it('uses the owner details in the text', () => {
    expect(by('about-us').markdown).toContain('Sample Media Private Limited, based in India');
    expect(by('about-us').markdown).toContain('since 2026');
    expect(by('contact-us').markdown).toContain('news@media.in');
    expect(by('contact-us').markdown).toContain('12 Main Road, Kolkata 700001, West Bengal');
    expect(by('ownership-and-funding').markdown).toContain('paid for by advertising');
    expect(by('privacy-policy').markdown).toContain('news@media.in');
    expect(by('terms-and-conditions').markdown).toContain('laws of India');
  });
  it('has no unfilled placeholder, no placeholder text and no emoji in any page', () => {
    for (const p of pages) {
      expect(p.markdown).not.toMatch(/\{\{|\}\}|\$\{|undefined|null/);
      expect(p.markdown).not.toMatch(/lorem ipsum|example\.com|your site name|\bTODO\b/i);
      expect(findIconGlyphs(p.markdown)).toEqual([]);
    }
  });
  it('has no H1 in the body (the page title is the only H1) and no skipped heading level', () => {
    for (const p of pages) {
      const body = p.markdown.split('---').slice(2).join('---');
      expect(body).not.toMatch(/^# /m);
      expect(body).not.toMatch(/^#{3,} /m);
    }
  });
  it('makes About and Contact pages that the schema code knows as AboutPage and ContactPage', () => {
    expect(pageKind('about-us')).toBe('AboutPage');
    expect(pageKind('contact-us')).toBe('ContactPage');
  });
  it('says only what the site really does (no chat or form, no promise of cookies by the analytics)', () => {
    const all = pages.map((p: { markdown: string }) => p.markdown).join('\n');
    expect(all).not.toMatch(/live chat|contact form/i);
    expect(by('privacy-policy').markdown).toMatch(/uses no cookies/);
    expect(by('privacy-policy').markdown).toMatch(/article pages only/);
  });
  it('cookie page says what the code really stores and that the site sets no cookie of its own', () => {
    const c = by('cookie-policy').markdown;
    expect(c).toMatch(/does not set cookies of its own/);
    expect(c).toMatch(/dark mode choice/);
    expect(c).toMatch(/random session number/);
    expect(c).toMatch(/article pages only/);
    expect(c).toMatch(/Ad choices button/);
    expect(c).toContain('news@media.in');
  });
  it('the site code really sets no cookie (the cookie page would be wrong otherwise)', () => {
    for (const f of ['src/layouts/Base.astro', 'src/lib/beacon-client.js', 'src/lib/ads-client.js', 'src/lib/trending-client.js']) {
      expect(read(f)).not.toMatch(/document\.cookie/);
    }
  });
  it('DMCA page says where to write and what to include; disclaimer gives no professional advice', () => {
    expect(by('dmca').markdown).toContain('news@media.in');
    expect(by('dmca').markdown).toMatch(/good faith/);
    expect(by('dmca').markdown).toContain('12 Main Road, Kolkata 700001, West Bengal');
    expect(by('disclaimer').markdown).toMatch(/Nothing on this site is legal, medical, financial/);
  });
  it('Advertise With Us page says where to write, that ads are in articles only and that advertisers cannot change news', () => {
    const a = by('advertise-with-us').markdown;
    expect(a).toContain('news@media.in');
    expect(a).toMatch(/subject/);
    expect(a).toMatch(/article pages only/);
    expect(a).toMatch(/cannot choose, see or change an article/);
    expect(a).toMatch(/marked as Sponsored/);
    expect(a).toContain('12 Main Road, Kolkata 700001, West Bengal');
  });
  it('Advertise With Us page invents no price, no visitor number and no promise', () => {
    const a = by('advertise-with-us').markdown;
    expect(a).not.toMatch(/\d+\s*(visitors|readers|views|users)/i);
    expect(a).not.toMatch(/[$\u20B9]\s*\d|rupees|per thousand|CPM/i);
    expect(a).toMatch(/do not publish a price list/);
  });
  it('Affiliate Disclosure page makes no claim that the site has affiliate links today, and says the fee does not decide coverage', () => {
    const d = by('affiliate-disclosure').markdown;
    expect(d).toMatch(/If an article on Shivam Das News contains an affiliate link/);
    expect(d).toMatch(/does not decide what we write/);
    expect(d).toMatch(/does not go up/);
    expect(d).toContain('news@media.in');
    expect(d).not.toMatch(/we (currently )?(earn|use|have) affiliate/i);
  });
  it('the two new pages are drafts by default and have one-line descriptions under 160 characters', () => {
    for (const slug of ['advertise-with-us', 'affiliate-disclosure']) {
      const m = by(slug).markdown;
      expect(m).toMatch(/^status: draft$/m);
      const line = m.split('\n').find((l: string) => l.startsWith('description: '))!;
      expect(JSON.parse(line.slice('description: '.length)).length).toBeLessThanOrEqual(160);
    }
  });
  it('stops when the site name is missing', () => {
    expect(() => buildPages({ publisher: good, siteName: '  ', now: NOW })).toThrow(/siteName/);
  });
  it('escapes a site name with quotes inside the front matter', () => {
    const p = buildPages({ publisher: good, siteName: 'The "Daily" News', now: NOW })[0];
    const line = p.markdown.split('\n').find((l: string) => l.startsWith('description: '))!;
    expect(JSON.parse(line.slice('description: '.length))).toContain('The "Daily" News');
  });
  it('keeps every description under 160 characters even with the longest allowed details', () => {
    const long = Object.fromEntries(FIELDS.map((f: { key: string; max: number }) => [f.key, 'a'.repeat(f.max)]));
    const p = buildPages({ publisher: { ...long, email: 'a@b.co', foundedYear: '2026' }, siteName: 'Shivam Das News', now: NOW });
    expect(p).toHaveLength(12);
  });
});

describe('Privacy page: checks that you are a person (BOT_PROTECTION 3d, v0.75.0)', () => {
  const priv = (features?: object) => buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW, features }).find((p: { slug: string }) => p.slug === 'privacy-policy')!.markdown as string;
  const contact = { endpoint: 'https://contact.example-worker.dev/contact', turnstileSiteKey: '0x4AAAAAAAabcdef' };

  it('says nothing about Turnstile or a stamp while no guarded feature is on', () => {
    for (const f of [undefined, {}, featuresFrom({})]) {
      expect(priv(f)).not.toMatch(/Turnstile|time stamp|Checks that you are a person/);
    }
  });
  it('featuresFrom turns a feature on only when its config is really filled', () => {
    expect(featuresFrom({})).toEqual({ contactForm: false, analytics: false, push: false });
    expect(featuresFrom({ contact: { endpoint: 'https://x.dev/contact', turnstileSiteKey: '' } }).contactForm).toBe(false);
    expect(featuresFrom({ contact: { endpoint: '', turnstileSiteKey: 'abcdefghij' } }).contactForm).toBe(false);
    expect(featuresFrom({ contact }).contactForm).toBe(true);
    expect(featuresFrom({ analytics: { endpoint: '  ' } }).analytics).toBe(false);
    expect(featuresFrom({ analytics: { endpoint: 'https://a.dev' } }).analytics).toBe(true);
    expect(featuresFrom({ push: { endpoint: 'https://p.dev', vapidPublicKey: '' } }).push).toBe(true);
    expect(featuresFrom({ contact: null, analytics: 'x', push: 5 } as never)).toEqual({ contactForm: false, analytics: false, push: false });
  });
  it('contact form on: names Cloudflare Turnstile and the stamp, once each', () => {
    const t = priv(featuresFrom({ contact }));
    expect(t).toMatch(/^## Checks that you are a person$/m);
    expect(t.match(/Cloudflare Turnstile/g)).toHaveLength(1);
    expect(t).toMatch(/When you use the form on the Contact Us page, our server first gives your browser a small signed time stamp/);
    expect(t).toMatch(/only a time and a signature/);
    expect(t).toMatch(/we do not store it/);
  });
  it('analytics only or push only: a stamp line but no Turnstile line (those two never use Turnstile)', () => {
    const a = priv(featuresFrom({ analytics: { endpoint: 'https://a.dev' } }));
    expect(a).toMatch(/When you read an article, our server first gives/);
    expect(a).not.toMatch(/Turnstile/);
    const p = priv(featuresFrom({ push: { endpoint: 'https://p.dev' } }));
    expect(p).toMatch(/When you sign up for notifications, our server first gives/);
    expect(p).not.toMatch(/Turnstile/);
  });
  it('all three on: one sentence that lists the uses with a comma and a final "or"', () => {
    const t = priv(featuresFrom({ contact, analytics: { endpoint: 'https://a.dev' }, push: { endpoint: 'https://p.dev' } }));
    expect(t).toMatch(/When you use the form on the Contact Us page, read an article or sign up for notifications, our server/);
  });
  it('the section sits between Advertising and Messages, keeps the heading rules and adds no emoji or placeholder', () => {
    const t = priv(featuresFrom({ contact, analytics: { endpoint: 'https://a.dev' }, push: { endpoint: 'https://p.dev' } }));
    expect(t.indexOf('## Advertising')).toBeLessThan(t.indexOf('## Checks that you are a person'));
    expect(t.indexOf('## Checks that you are a person')).toBeLessThan(t.indexOf('## Messages you send us'));
    const body = t.split('---').slice(2).join('---');
    expect(body).not.toMatch(/^# /m);
    expect(body).not.toMatch(/^#{3,} /m);
    expect(findIconGlyphs(t)).toEqual([]);
    expect(t).not.toMatch(/\{\{|\}\}|\$\{|undefined|null|lorem ipsum|example\.com|\bTODO\b/i);
  });
  it('only the Privacy page changes; the other eleven pages are identical with every feature on', () => {
    const off = buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW });
    const on = buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW, features: featuresFrom({ contact, analytics: { endpoint: 'https://a.dev' }, push: { endpoint: 'https://p.dev' } }) });
    for (let i = 0; i < off.length; i++) {
      if (off[i].slug === 'privacy-policy') expect(on[i].markdown).not.toBe(off[i].markdown);
      else expect(on[i].markdown).toBe(off[i].markdown);
    }
  });
  it('the descriptions stay under 160 characters (the new section does not touch them)', () => {
    const on = buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW, features: { contactForm: true, analytics: true, push: true } });
    for (const p of on) {
      const line = p.markdown.split('\n').find((l: string) => l.startsWith('description: '))!;
      expect(JSON.parse(line.slice('description: '.length)).length).toBeLessThanOrEqual(160);
    }
  });
  it('what the page says is true of the code: the stamp holds only a time and a signature, the contact page really loads Turnstile', () => {
    expect(read('../workers/shared/guard.js')).toMatch(/return `\$\{t\}\.\$\{await sign\(secret, `\$\{route\}\|\$\{t\}`\)\}`/);
    expect(read('src/components/ContactForm.astro')).toMatch(/challenges\.cloudflare\.com\/turnstile/);
  });
});

describe('planWrites', () => {
  const pages = buildPages({ publisher: good, siteName: 'Shivam Das News', now: NOW });
  it('writes everything on a clean folder', () => {
    const r = planWrites(pages, []);
    expect(r.write).toHaveLength(12);
    expect(r.skip).toHaveLength(0);
  });
  it('never touches a page that already exists', () => {
    const r = planWrites(pages, ['about-us', 'privacy-policy', 'something-else']);
    expect(r.skip.map((p: { slug: string }) => p.slug)).toEqual(['about-us', 'privacy-policy']);
    expect(r.write).toHaveLength(10);
  });
});

describe('npm run pages (scripts/make-pages.mjs)', () => {
  const run = (root: string, ...args: string[]) => spawnSync('node', ['scripts/make-pages.mjs', '--root', root, ...args], { encoding: 'utf8' });
  const setup = (publisher: object) => {
    const root = mkdtempSync(join(tmpdir(), 'pages-'));
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'config/site.json'), JSON.stringify({ siteName: 'Shivam Das News' }));
    writeFileSync(join(root, 'config/publisher.json'), JSON.stringify(publisher));
    return root;
  };

  it('writes nothing and says what is missing while publisher.json is empty', () => {
    const root = setup(JSON.parse(read('tests/fixtures/shipped/config/publisher.json')));
    const r = run(root);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/missing: legalName/);
    expect(readdirSync(root)).not.toContain('content');
    rmSync(root, { recursive: true });
  });
  it('--dry shows the plan and writes nothing', () => {
    const root = setup(good);
    const r = run(root, '--dry');
    expect(r.status).toBe(0);
    expect(r.stdout.match(/would write/g)).toHaveLength(12);
    expect(readdirSync(root)).not.toContain('content');
    rmSync(root, { recursive: true });
  });
  it('writes twelve draft files, and on a second run leaves them alone', () => {
    const root = setup(good);
    const first = run(root);
    expect(first.status).toBe(0);
    const files = readdirSync(join(root, 'content/pages')).sort();
    expect(files).toHaveLength(12);
    expect(read(join(root, 'content/pages/about-us.md'))).toMatch(/^status: draft$/m);
    const before = read(join(root, 'content/pages/about-us.md'));
    const second = run(root, '--publish');
    expect(second.status).toBe(0);
    expect(second.stdout.match(/left alone/g)).toHaveLength(12);
    expect(read(join(root, 'content/pages/about-us.md'))).toBe(before);
    rmSync(root, { recursive: true });
  });
  it('--publish writes published pages on a clean folder', () => {
    const root = setup(good);
    expect(run(root, '--publish').status).toBe(0);
    expect(read(join(root, 'content/pages/contact-us.md'))).toMatch(/^status: published$/m);
    rmSync(root, { recursive: true });
  });
  it('skips a page whose permalink exists under another file name', () => {
    const root = setup(good);
    mkdirSync(join(root, 'content/pages'), { recursive: true });
    writeFileSync(join(root, 'content/pages/my-own-about.md'), '---\ntitle: "About"\npermalink: "about-us"\ndate: 2026-01-01\nstatus: published\n---\n\nHand written.\n');
    const r = run(root);
    expect(r.stdout).toMatch(/left alone\s+about-us/);
    expect(readdirSync(join(root, 'content/pages'))).toHaveLength(12); // 11 new + the hand written one
    rmSync(root, { recursive: true });
  });
  it('stops with a plain message when a file is missing or broken', () => {
    const root = mkdtempSync(join(tmpdir(), 'pages-'));
    expect(run(root).stderr).toMatch(/config\/site\.json is missing/);
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'config/site.json'), '{ not json');
    expect(run(root).stderr).toMatch(/not valid JSON/);
    rmSync(root, { recursive: true });
  });
  it('writes the Turnstile and stamp section only when the config files are filled (v0.75.0)', () => {
    const rootOff = setup(good);
    expect(run(rootOff).status).toBe(0);
    expect(read(join(rootOff, 'content/pages/privacy-policy.md'))).not.toMatch(/Turnstile|time stamp/);
    const rootOn = setup(good);
    writeFileSync(join(rootOn, 'config/contact.json'), JSON.stringify({ endpoint: 'https://contact.example-worker.dev/contact', turnstileSiteKey: '0x4AAAAAAAabcdef' }));
    writeFileSync(join(rootOn, 'config/push.json'), JSON.stringify({ endpoint: 'https://push.example-worker.dev', vapidPublicKey: '' }));
    expect(run(rootOn).status).toBe(0);
    const t = read(join(rootOn, 'content/pages/privacy-policy.md'));
    expect(t).toMatch(/Cloudflare Turnstile/);
    expect(t).toMatch(/When you use the form on the Contact Us page or sign up for notifications/);
    rmSync(rootOff, { recursive: true });
    rmSync(rootOn, { recursive: true });
  });
  it('a missing optional config file means "feature off", a broken one stops with a plain message', () => {
    const root = setup(good);
    writeFileSync(join(root, 'config/analytics.json'), '{ not json');
    const r = run(root);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/config\/analytics\.json is not valid JSON/);
    rmSync(root, { recursive: true });
  });
});
