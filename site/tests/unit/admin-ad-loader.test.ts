// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';

const post = stringify({ title: 'A story that moved once', permalink: 'moved-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: '/media/a.webp', imageAlt: 'alt', status: 'published', redirects: ['/2026/11/12/blogs/news/moved-story/'] }, '## Body\ntext');
const files: Record<string, string> = {
  'site/content/blogs/technology/moved-story.md': post,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
  'site/content/pages/about.md': stringify({ title: 'About us', permalink: 'about', date: '2026-11-01T00:00:00Z', status: 'published' }, 'About text.'),
  'site/config/ads.json': JSON.stringify({ adsensePublisherId: '', extraLines: [] }),
  'site/config/ad-loader.json': JSON.stringify({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '' } }),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
};
const puts: { path: string; text: string }[] = [];
function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') { const text = decodeText(JSON.parse(init.body).content); puts.push({ path, text }); files[path] = text; return json({ content: { sha: 'new-sha' } }); }
  if (u.pathname.startsWith('/repos/o/r/contents/')) return files[path] ? json({ content: toBase64(files[path]), sha: 'sha-' + path }) : json({ message: 'Not Found' }, 404);
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const find = (sel: string) => document.querySelector(sel) as HTMLElement;
const byText = (tag: string, text: string) => [...document.querySelectorAll(tag)].find((e) => e.textContent!.trim() === text) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

const GEO = 'https://news-geo.test.workers.dev/geo';
const POP = 'https://ads.test-network.dev/pop.js';

describe('Ad loader screen (jsdom)', () => {
  let asked: string[] = [];
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; asked = []; sessionStorage.clear(); sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '' } }); });
  const open = async (answer = true) => {
    vi.stubGlobal('confirm', (m: string) => { asked.push(m); return answer; });
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.resetModules();
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/ad-loader';
    await tick(300);
  };
  const fire = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const untick = () => { const c = find('#al-compliance') as HTMLInputElement; c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); };

  it('starts safe: compliance mode ticked, everything empty, and the menu has the screen', async () => {
    await open();
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toContain('Ad loader');
    expect((find('#al-compliance') as HTMLInputElement).checked).toBe(true);
    expect((find('#al-geo') as HTMLInputElement).value).toBe('');
    expect(document.body.textContent).toContain('OFF: compliance mode is on');
  });

  it('describes live, asks before turning scripts ON, and saves one checked file', async () => {
    await open(true);
    fire(find('#al-geo'), GEO);
    fire(find('#al-pop'), POP);
    expect(document.body.textContent).toContain('OFF: compliance mode is on');
    untick();
    expect(document.body.textContent).toContain('ON for article pages only');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(asked).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('site/config/ad-loader.json');
    expect(JSON.parse(puts[0].text)).toEqual({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: '', smartlink: '', nativeBanner: { script: '', containerId: '', afterParagraph: 3 } }, adsense: { slot: '', afterParagraph: 5 }, consentDays: 180 });
  });

  it('saves nothing when the owner answers no in the confirm box', async () => {
    await open(false);
    fire(find('#al-geo'), GEO);
    fire(find('#al-pop'), POP);
    untick();
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(asked).toHaveLength(1);
    expect(puts).toHaveLength(0);
  });

  it('saves values with compliance mode still on, without a confirm box (nothing goes live)', async () => {
    await open(true);
    fire(find('#al-geo'), GEO);
    fire(find('#al-bar'), 'https://ads.test-network.dev/bar.js');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(asked).toHaveLength(0);
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0].text).complianceMode).toBe(true);
  });

  it('shows a plain message and saves nothing for a bad address', async () => {
    await open();
    fire(find('#al-geo'), 'http://news-geo.test/geo');
    expect(document.body.textContent).toContain('must start with https://');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
  });

  it('refuses a script without the geo address and saves nothing', async () => {
    await open();
    untick();
    fire(find('#al-pop'), POP);
    expect(document.body.textContent).toContain('geo address is empty');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
  });

  it('does not ask again when the saved file already has scripts ON', async () => {
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: '' } });
    await open(true);
    expect((find('#al-compliance') as HTMLInputElement).checked).toBe(false);
    expect(document.body.textContent).toContain('ON for article pages only');
    fire(find('#al-bar'), 'https://ads.test-network.dev/bar.js');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(asked).toHaveLength(0);
    expect(puts).toHaveLength(1);
  });

  it('native banner: shows the three boxes, describes live, and saves the checked values (v0.22.0)', async () => {
    await open(true);
    expect((find('#al-native-after') as HTMLInputElement).value).toBe('3');
    fire(find('#al-geo'), GEO);
    fire(find('#al-native-script'), 'https://ads.test-network.dev/native.js');
    expect(document.body.textContent).toContain('needs both the script address and the container id');
    fire(find('#al-native-id'), 'container-1a2b3c');
    fire(find('#al-native-after'), '5');
    untick();
    expect(document.body.textContent).toContain('native banner (after paragraph 5');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(asked).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0].text).adsterra.nativeBanner).toEqual({ script: 'https://ads.test-network.dev/native.js', containerId: 'container-1a2b3c', afterParagraph: 5 });
  });

  it('native banner: a half-filled banner or a bad paragraph number saves nothing', async () => {
    await open();
    fire(find('#al-native-id'), 'container-1a2b3c');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
    fire(find('#al-native-id'), '');
    fire(find('#al-native-after'), '40');
    expect(document.body.textContent).toContain('whole number from 1 to 20');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
  });

  it('native banner: reads a saved native banner back into the boxes', async () => {
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: 'https://ads.test-network.dev/native.js', containerId: 'box-9', afterParagraph: 8 } } });
    await open(true);
    expect((find('#al-native-id') as HTMLInputElement).value).toBe('box-9');
    expect((find('#al-native-after') as HTMLInputElement).value).toBe('8');
    expect(document.body.textContent).toContain('ON for article pages only');
  });

  it('smartlink: describes live, asks before turning ON, and saves the checked address (v0.23.0)', async () => {
    await open(true);
    fire(find('#al-geo'), GEO);
    fire(find('#al-smartlink'), 'https://ads.test-network.dev/smart-abc');
    untick();
    expect(document.body.textContent).toContain('smartlink (opens one time when a reader clicks a picture');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(asked).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0].text).adsterra.smartlink).toBe('https://ads.test-network.dev/smart-abc');
  });

  it('smartlink: a bad address saves nothing, and a saved one is read back', async () => {
    await open();
    fire(find('#al-smartlink'), 'http://ads.test-network.dev/s');
    expect(document.body.textContent).toContain('must start with https://');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: false, geoUrl: GEO, adsterra: { smartlink: 'https://ads.test-network.dev/smart-abc' } });
    await open(true);
    expect((find('#al-smartlink') as HTMLInputElement).value).toBe('https://ads.test-network.dev/smart-abc');
  });
  // ---- v0.24.0: AdSense unit ----
  const PUBID = 'ca-pub-1234567890123456';
  const withPub = () => { files['site/config/ads.json'] = JSON.stringify({ adsensePublisherId: PUBID, extraLines: [] }); };
  const noPub = () => { files['site/config/ads.json'] = JSON.stringify({ adsensePublisherId: '', extraLines: [] }); };

  it('AdSense: shows the two boxes with the defaults, and tells which AdSense id was found', async () => {
    withPub();
    await open();
    expect((find('#al-adsense-slot') as HTMLInputElement).value).toBe('');
    expect((find('#al-adsense-after') as HTMLInputElement).value).toBe('5');
    expect(document.body.textContent).toContain('found: ca-pub-1234567890123456');
    noPub();
  });

  it('AdSense: describes live, asks before turning ON, and saves the checked slot (v0.24.0)', async () => {
    withPub();
    await open(true);
    fire(find('#al-geo'), GEO);
    fire(find('#al-adsense-slot'), '1234567890');
    fire(find('#al-adsense-after'), '6');
    untick();
    expect(document.body.textContent).toContain('AdSense unit (after paragraph 6');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(asked).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('site/config/ad-loader.json');
    expect(JSON.parse(puts[0].text).adsense).toEqual({ slot: '1234567890', afterParagraph: 6 });
    noPub();
  });

  it('AdSense: a slot without a saved AdSense id, a bad slot, or the same paragraph as the native banner saves nothing', async () => {
    noPub();
    await open();
    fire(find('#al-adsense-slot'), '1234567890');
    expect(document.body.textContent).toContain('no AdSense id yet');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
    withPub();
    await open();
    fire(find('#al-adsense-slot'), 'abc');
    expect(document.body.textContent).toContain('AdSense slot');
    fire(find('#al-adsense-slot'), '1234567890');
    fire(find('#al-native-script'), 'https://ads.test-network.dev/native.js');
    fire(find('#al-native-id'), 'box-1');
    fire(find('#al-native-after'), '5');
    expect(document.body.textContent).toContain('same paragraph number');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
    noPub();
  });

  it('AdSense: reads a saved unit back into the boxes, and an old file without one still opens', async () => {
    withPub();
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: false, geoUrl: GEO, adsense: { slot: '9876543210', afterParagraph: 9 } });
    await open(true);
    expect((find('#al-adsense-slot') as HTMLInputElement).value).toBe('9876543210');
    expect((find('#al-adsense-after') as HTMLInputElement).value).toBe('9');
    expect(document.body.textContent).toContain('ON for article pages only');
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '' } });
    await open(true);
    expect((find('#al-adsense-after') as HTMLInputElement).value).toBe('5');
    noPub();
  });

  it('consent days (v0.28.0): the box shows 180, says the days in the sentence, and saves a changed number', async () => {
    await open(true);
    expect((find('#al-consent-days') as HTMLInputElement).value).toBe('180');
    fire(find('#al-geo'), GEO);
    fire(find('#al-pop'), POP);
    untick();
    expect(document.body.textContent).toContain('kept 180 days');
    fire(find('#al-consent-days'), '90');
    expect(document.body.textContent).toContain('kept 90 days');
    byText('button', 'Save ad loader settings').click();
    await tick(400);
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0].text).consentDays).toBe(90);
  });

  it('consent days (v0.28.0): a bad number gives a plain message and saves nothing; an old file opens with 180', async () => {
    await open(true);
    fire(find('#al-consent-days'), '10');
    expect(document.body.textContent).toContain('whole number from 30 to 365');
    byText('button', 'Save ad loader settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: true, geoUrl: '', consentDays: 365 });
    await open(true);
    expect((find('#al-consent-days') as HTMLInputElement).value).toBe('365');
    files['site/config/ad-loader.json'] = JSON.stringify({ complianceMode: true, geoUrl: '', consentDays: 5 });
    await open(true);
    expect((find('#al-consent-days') as HTMLInputElement).value).toBe('180');
  });
});
