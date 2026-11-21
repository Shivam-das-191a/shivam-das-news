import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// v0.85.0 (BOT_PROTECTION Part 6a), v0.86.0 (Part 6b-1) and v0.87.0 (Part 6b-2a) and v0.87.1 (Part 6b-2b) and v0.88.0 (Part 6b-3a): the page headers in public/_headers.
const text = readFileSync('public/_headers', 'utf8');

// Reads the file the way Cloudflare Pages does: a line that starts at the left is a path, the indented lines below it are its headers.
function blocks(src: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let cur: string | null = null;
  for (const line of src.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = line.trim(); out[cur] = {}; continue; }
    const d = /^ {2}! ([A-Za-z0-9-]+)$/.exec(line); // a detach line: this path does NOT take that header from the all-paths block
    if (d && cur) { out[cur]['!' + d[1]] = ''; continue; }
    const m = /^ {2}([A-Za-z0-9-]+): (.+)$/.exec(line);
    if (!m || !cur) throw new Error('bad line in _headers: ' + line);
    out[cur][m[1]] = m[2];
  }
  return out;
}
const b = blocks(text);

describe('headers for every page (Part 6a)', () => {
  it('has the block for all paths with the four headers', () => {
    expect(Object.keys(b['/*']).sort()).toEqual(['Content-Security-Policy-Report-Only', 'Permissions-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options']);
    expect(b['/*']['X-Content-Type-Options']).toBe('nosniff');
  });

  it('the permissions policy switches off camera, microphone, location and payment, and does not touch what push or the site need', () => {
    const v = b['/*']['Permissions-Policy'];
    for (const f of ['camera', 'microphone', 'geolocation', 'payment']) expect(v).toContain(f + '=()');
    expect(v).not.toMatch(/notifications|push|fullscreen|clipboard|storage-access|web-share/);
  });

  it('HSTS lasts one year or more, and has no preload word (a preload cannot be taken back)', () => {
    const v = b['/*']['Strict-Transport-Security'];
    const age = Number(/max-age=(\d+)/.exec(v)?.[1] ?? 0);
    expect(age >= 31536000).toBe(true);
    expect(v).not.toMatch(/preload/i);
  });

  it('no header is sent twice: the other blocks never set a header that the all-paths block sets', () => {
    for (const [path, h] of Object.entries(b)) {
      if (path === '/*') continue;
      for (const name of Object.keys(b['/*'])) {
        if (Object.keys(h).includes('!' + name)) continue; // a block that takes the all-paths header off (a detach line, '!Name') may set its own in its place (the Contact Us policy, Part 6b-2a)
        expect(Object.keys(h), path + ' repeats ' + name).not.toContain(name);
      }
    }
  });

  it('Referrer-Policy is not in the all-paths block (the dashboard keeps no-referrer); public pages get it from a meta tag before the head slot', () => {
    expect(Object.keys(b['/*'])).not.toContain('Referrer-Policy');
    expect(b['/admin/*']['Referrer-Policy']).toBe('no-referrer');
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(base).toContain('<meta name="referrer" content="strict-origin-when-cross-origin">');
    expect(base.indexOf('name="referrer"')).toBeLessThan(base.indexOf('<slot name="head" />'));
  });

  it('the dashboard and the other blocks keep what they had', () => {
    const { ['Content-Security-Policy-Report-Only']: dashPolicy, ...dashRest } = b['/admin/*']; // the dashboard policy has its own tests below (Part 6b-2b)
    expect(dashPolicy.length > 0).toBe(true);
    expect(dashRest).toEqual({ 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', '!Content-Security-Policy-Report-Only': '' });
    expect(b['/gone.json']).toEqual({ 'X-Robots-Tag': 'noindex' });
    expect(b['/trending-titles.json']).toEqual({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=300' });
    expect(b['/title-index.json']).toEqual({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=300' });
    expect(b['/push-sw.js']).toEqual({ 'Cache-Control': 'no-cache' });
  });

  it('the file is clean: no tab, no header line without a path, no empty value', () => {
    expect(text).not.toMatch(/\t/);
    expect(Object.keys(b).every((p) => p.startsWith('/'))).toBe(true);
    for (const h of Object.values(b)) for (const [k, v] of Object.entries(h)) if (!k.startsWith('!')) expect(v.trim().length > 0).toBe(true);
  });

  it('the content policy only reports (it never blocks) and is not an enforcing header', () => {
    expect(text).not.toMatch(/^\s+Content-Security-Policy:/m);
    expect(b['/admin/*']['!Content-Security-Policy-Report-Only']).toBe('');
  });

  const csp = b['/*']['Content-Security-Policy-Report-Only'];
  const parts = Object.fromEntries(csp.split(';').map((x) => x.trim()).filter(Boolean).map((x) => [x.split(' ')[0], x.split(' ').slice(1)]));

  it('the policy has the safe basics: no eval, no object, no foreign base or form, no framing, no wildcard script host', () => {
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(parts['object-src']).toEqual(["'none'"]);
    expect(parts['base-uri']).toEqual(["'self'"]);
    expect(parts['form-action']).toEqual(["'self'"]);
    expect(parts['frame-ancestors']).toEqual(["'none'"]);
    expect(parts['default-src']).toEqual(["'self'"]);
    expect(parts['script-src']).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp).not.toMatch(/(?:script-src|default-src)[^;]*(?:\*|https:)/);
  });

  it('the all-paths policy names no ad host and no Turnstile host: the form page has its own (Part 6b-2a), article pages with ads are written last (Part 6b-3)', () => {
    expect(csp).not.toMatch(/adsterra|bicea|afders|arwf|googlesyndication|doubleclick|challenges\.cloudflare/i);
  });
});

describe('the Contact Us page policy (Part 6b-2a)', () => {
  const path = '/:year/:month/:day/pages/contact-us/';
  const all = b['/*']['Content-Security-Policy-Report-Only'];
  const own = b[path]?.['Content-Security-Policy-Report-Only'] ?? '';
  const dir = (c: string) => Object.fromEntries(c.split(';').map((x) => x.trim()).filter(Boolean).map((x) => [x.split(' ')[0], x.split(' ').slice(1)]));
  const a = dir(all);
  const f = dir(own);
  const matches = (pattern: string, url: string) => new RegExp('^' + pattern.replace(/:[A-Za-z]+/g, '[^/]+') + '$').test(url); // a placeholder stands for one part of the address

  it('has a block that takes the all-paths policy off and sets its own, and nothing else', () => {
    expect(Object.keys(b[path] ?? {}).sort()).toEqual(['!Content-Security-Policy-Report-Only', 'Content-Security-Policy-Report-Only']);
  });

  it('the path matches the real Contact Us address on any date, and no other page', () => {
    expect(matches(path, '/2026/11/16/pages/contact-us/')).toBe(true);
    expect(matches(path, '/2027/01/02/pages/contact-us/')).toBe(true);
    expect(matches(path, '/2026/11/16/pages/about-us/')).toBe(false);
    expect(matches(path, '/2026/11/16/blogs/technology/contact-us/')).toBe(false);
    expect(matches(path, '/')).toBe(false);
    expect(matches(path, '/admin/')).toBe(false);
  });

  it('the page and the plan use the same slug, contact-us', () => {
    expect(readFileSync('src/pages/[year]/[month]/[day]/pages/[slug].astro', 'utf8')).toContain("page.data.permalink === 'contact-us' && <ContactForm />");
    expect(readFileSync('scripts/required-pages-lib.mjs', 'utf8')).toContain("slug: 'contact-us'");
  });

  it('it is the all-paths policy plus the one Turnstile host, for scripts and frames only', () => {
    expect(f['script-src']).toEqual([...a['script-src'], 'https://challenges.cloudflare.com']);
    expect(f['frame-src']).toEqual(['https://challenges.cloudflare.com']);
    for (const k of Object.keys(a)) if (k !== 'script-src' && k !== 'frame-src') expect(f[k], k).toEqual(a[k]);
    expect(Object.keys(f).sort()).toEqual(Object.keys(a).sort());
  });

  it('it keeps the safe basics: no eval, no wildcard, no other host, no ad host, never enforcing', () => {
    expect(own).not.toMatch(/unsafe-eval|\*/);
    expect(own.match(/https:\/\/[a-z0-9.-]+/g)).toEqual(['https://challenges.cloudflare.com', 'https://challenges.cloudflare.com']);
    expect(own).not.toMatch(/adsterra|bicea|afders|arwf|googlesyndication|doubleclick/i);
    expect(f['object-src']).toEqual(["'none'"]);
    expect(f['base-uri']).toEqual(["'self'"]);
    expect(f['form-action']).toEqual(["'self'"]);
    expect(f['frame-ancestors']).toEqual(["'none'"]);
    expect(text).not.toMatch(/^\s+Content-Security-Policy:/m);
  });

  it('the Turnstile script in the form component comes from the one host the policy names', () => {
    const c = readFileSync('src/components/ContactForm.astro', 'utf8');
    expect(c).toContain('src="https://challenges.cloudflare.com/turnstile/v0/api.js"');
    const hosts = c.match(/https:\/\/[a-z0-9.-]+/g) ?? [];
    expect(hosts.every((h) => h === 'https://challenges.cloudflare.com')).toBe(true);
  });
});

describe('the dashboard policy (Part 6b-2b)', () => {
  const all = b['/*']['Content-Security-Policy-Report-Only'];
  const dash = b['/admin/*']['Content-Security-Policy-Report-Only'] ?? '';
  const tool = b['/admin/blog-xml-tool.html']?.['Content-Security-Policy-Report-Only'] ?? '';
  const dir = (c: string) => Object.fromEntries(c.split(';').map((x) => x.trim()).filter(Boolean).map((x) => [x.split(' ')[0], x.split(' ').slice(1)]));
  const a = dir(all);
  const d = dir(dash);

  it('the dashboard block takes the all-paths policy off and sets its own; the old Blogger tool has the same two lines', () => {
    expect(Object.keys(b['/admin/*']).includes('!Content-Security-Policy-Report-Only')).toBe(true);
    expect(Object.keys(b['/admin/blog-xml-tool.html'] ?? {}).sort()).toEqual(['!Content-Security-Policy-Report-Only', 'Content-Security-Policy-Report-Only']);
  });

  it('scripts come from the dashboard itself only: no inline script, no host, no eval', () => {
    expect(d['script-src']).toEqual(["'self'"]);
    expect(dash).not.toMatch(/unsafe-eval|\*/);
    expect(dash).not.toMatch(/adsterra|bicea|afders|arwf|googlesyndication|doubleclick|challenges\.cloudflare/i);
  });

  it('it is the all-paths policy with two differences only: script-src without unsafe-inline, img-src with blob: (the image previews)', () => {
    expect(d['img-src']).toEqual([...a['img-src'].slice(0, 1), 'blob:', ...a['img-src'].slice(1)]);
    for (const k of Object.keys(a)) if (k !== 'script-src' && k !== 'img-src') expect(d[k], k).toEqual(a[k]);
    expect(Object.keys(d).sort()).toEqual(Object.keys(a).sort());
  });

  it('it keeps the safe basics and is never enforcing', () => {
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
    expect(d['form-action']).toEqual(["'self'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['frame-src']).toEqual(["'none'"]);
    expect(text).not.toMatch(/^\s+Content-Security-Policy:/m);
  });

  it('the dashboard page really needs nothing more: one module script from itself, no inline script, no inline handler, no other host', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toEqual(['<script type="module" src="/admin/js/main.js">']);
    expect(html).not.toMatch(/<script[^>]*>[^<\s]/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/(?:src|href)="https?:/i);
  });

  it('no dashboard script builds a script, runs text as code or loads code from another host', () => {
    for (const f of readdirSync('public/admin/js')) {
      const c = readFileSync('public/admin/js/' + f, 'utf8');
      expect(c, f).not.toMatch(/createElement\(['"]script|\beval\(|new Function\(|document\.write|[^\w.]import\(|importScripts|javascript:/);
    }
  });

  it('the old Blogger tool has an inline script, so it gets the all-paths policy back (an own, weaker line for that one file only)', () => {
    expect(readFileSync('public/admin/blog-xml-tool.html', 'utf8')).toMatch(/<script>\s/);
    expect(tool).toBe(all);
  });
});

describe('the article page policy (Part 6b-3a)', () => {
  const path = '/:year/:month/:day/blogs/:category/:slug/';
  const all = b['/*']['Content-Security-Policy-Report-Only'];
  const own = b[path]?.['Content-Security-Policy-Report-Only'] ?? '';
  const dir = (c: string) => Object.fromEntries(c.split(';').map((x) => x.trim()).filter(Boolean).map((x) => [x.split(' ')[0], x.split(' ').slice(1)]));
  const a = dir(all);
  const f = dir(own);
  const matches = (pattern: string, url: string) => new RegExp('^' + pattern.replace(/:[A-Za-z]+/g, '[^/]+') + '$').test(url);
  const host = (u: string) => new URL(u).origin;
  const cfg = JSON.parse(readFileSync('config/ad-loader.json', 'utf8'));

  it('has a block that takes the all-paths policy off and sets its own, and nothing else', () => {
    expect(Object.keys(b[path] ?? {}).sort()).toEqual(['!Content-Security-Policy-Report-Only', 'Content-Security-Policy-Report-Only']);
  });

  it('the path matches an article address on any date and category, and no other page type', () => {
    expect(matches(path, '/2026/11/13/blogs/technology/new-phone-launched/')).toBe(true);
    expect(matches(path, '/2027/01/02/blogs/world/a-story/')).toBe(true);
    expect(matches(path, '/2026/11/13/pages/contact-us/')).toBe(false);
    expect(matches(path, '/category/technology/')).toBe(false);
    expect(matches(path, '/tag/phones/')).toBe(false);
    expect(matches(path, '/')).toBe(false);
    expect(matches(path, '/admin/')).toBe(false);
  });

  it('the ad loader is used by the article template and by no other page', () => {
    const used: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.astro$/.test(e.name) && readFileSync(p, 'utf8').includes('<AdLoader')) used.push(p.replace(/\\/g, '/')); } };
    walk('src');
    expect(used).toEqual(['src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro']);
  });

  it('it is the all-paths policy plus ad hosts in script-src and frame-src only', () => {
    for (const k of Object.keys(a)) if (k !== 'script-src' && k !== 'frame-src') expect(f[k], k).toEqual(a[k]);
    expect(Object.keys(f).sort()).toEqual(Object.keys(a).sort());
    expect(f['script-src'].slice(0, 2)).toEqual(a['script-src']);
    expect(f['frame-src'].every((h) => /^https:\/\/[a-z0-9.-]+$/.test(h))).toBe(true);
  });

  it('ads on: every script host named in config/ad-loader.json is in script-src (a new host in the dashboard fails this test until it is added to _headers)', () => {
    const scripts = [cfg.adsterra.popunder, cfg.adsterra.socialBar, cfg.adsterra.nativeBanner.script].filter(Boolean).map(host);
    expect(scripts.length > 0).toBe(true);
    for (const h of scripts) expect(f['script-src'], 'add ' + h + ' to the article policy in public/_headers').toContain(h);
  });

  it('the AdSense script host written in ads-client.js is in script-src', () => {
    const client = readFileSync('src/lib/ads-client.js', 'utf8');
    const h = host(/https:\/\/pagead2\.googlesyndication\.com[^'"]*/.exec(client)![0]);
    expect(f['script-src']).toContain(h);
  });

  it('the smartlink host is not a script host (a new tab opens it, a script never loads from it)', () => {
    expect(f['script-src']).not.toContain(host(cfg.adsterra.smartlink));
    expect(f['frame-src']).not.toContain(host(cfg.adsterra.smartlink));
  });

  it('it keeps the safe basics: no eval, no wildcard, no https: or blob: or data: script source, never enforcing', () => {
    expect(own).not.toMatch(/unsafe-eval|\*/);
    expect(f['script-src'].every((x) => x === "'self'" || x === "'unsafe-inline'" || /^https:\/\/[a-z0-9.-]+$/.test(x))).toBe(true);
    expect(f['object-src']).toEqual(["'none'"]);
    expect(f['base-uri']).toEqual(["'self'"]);
    expect(f['form-action']).toEqual(["'self'"]);
    expect(f['frame-ancestors']).toEqual(["'none'"]);
    expect(text).not.toMatch(/^\s+Content-Security-Policy:/m);
  });

  it('ads off (the all-paths policy) and the form page still have no ad host', () => {
    expect(all).not.toMatch(/adsterra|bicea|afders|arwf|googlesyndication|doubleclick/i);
    expect(b['/:year/:month/:day/pages/contact-us/']['Content-Security-Policy-Report-Only']).not.toMatch(/adsterra|bicea|afders|arwf|googlesyndication|doubleclick/i);
  });
});
