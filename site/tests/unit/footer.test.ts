import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { projectLinks, socialLinks, MAX_PROJECTS } from '../../src/lib/footer';
import { ICONS } from '../../src/lib/svg-icons';

const read = (f: string) => readFileSync(f, 'utf8');

describe('footer projects (config/footer.json)', () => {
  it('the shipped file lists the two projects with their own icons', () => {
    expect(projectLinks(JSON.parse(read('config/footer.json')))).toEqual([
      { name: 'Physically Near Help Me', url: 'https://www.shivam-das-2.online/', icon: 'mark-h' },
      { name: 'Shivam Das E-commerce', url: 'https://www.shivam-das-3.online/', icon: 'mark-s' },
    ]);
  });
  it('is empty without a list', () => {
    expect(projectLinks({})).toEqual([]);
    expect(projectLinks(null)).toEqual([]);
    expect(projectLinks({ projects: 'x' })).toEqual([]);
  });
  it('stops the build on a bad entry', () => {
    const p = (o: any) => () => projectLinks({ projects: [{ name: 'A', url: 'https://a.test.online/', icon: 'x', ...o }] });
    expect(p({})).not.toThrow();
    expect(p({ name: ' ' })).toThrow(/no name/);
    expect(p({ url: 'http://a.online/' })).toThrow(/https/);
    expect(p({ url: 'javascript:alert(1)' })).toThrow();
    expect(p({ url: 'https://a.online/" onclick="x' })).toThrow(/unsafe/);
    expect(p({ url: 'https://u:p@a.online/' })).toThrow(/user name/);
    expect(p({ url: 'https://localhost/' })).toThrow(/host/);
    expect(p({ icon: 'nope' })).toThrow(/does not exist/);
    expect(() => projectLinks({ projects: [{ name: 'A', url: 'https://a.online/', icon: 'x' }, { name: 'B', url: 'https://a.online/', icon: 'x' }] })).toThrow(/repeats/);
    expect(() => projectLinks({ projects: Array.from({ length: MAX_PROJECTS + 1 }, (_, i) => ({ name: `P${i}`, url: `https://p${i}.online/`, icon: 'x' })) })).toThrow(/at most/);
  });
});

describe('footer social accounts (sameAs in config/site.json)', () => {
  it('shows nothing while sameAs is empty (no placeholder accounts)', () => {
    expect(socialLinks([])).toEqual([]);
    expect(socialLinks(undefined)).toEqual([]);
    expect(socialLinks(JSON.parse(read('config/site.json')).sameAs).every((s) => s.url.startsWith('https://'))).toBe(true);
  });
  it('gives X its icon, in both host spellings, and shows another site by host name', () => {
    expect(socialLinks(['https://x.com/someone', 'https://twitter.com/other', 'https://www.facebook.com/page'])).toEqual([
      { url: 'https://x.com/someone', label: 'X', icon: 'x' },
      { url: 'https://twitter.com/other', label: 'X', icon: 'x' },
      { url: 'https://www.facebook.com/page', label: 'facebook.com', icon: null },
    ]);
  });
  it('drops a repeated address and stops the build on a bad one', () => {
    expect(socialLinks(['https://x.com/a', 'https://x.com/a']).length).toBe(1);
    expect(() => socialLinks(['http://x.com/a'])).toThrow(/https/);
    expect(() => socialLinks(['not a url'])).toThrow();
  });
});

describe('footer icons and template', () => {
  it('the X logo and both marks exist as inline drawings with no fixed colour (colours are CSS classes)', () => {
    for (const n of ['x', 'mark-h', 'mark-s']) {
      expect(ICONS[n], n).toBeTruthy();
      expect(ICONS[n], n).not.toMatch(/#[0-9a-fA-F]{3,6}\b|href|<image|<script/i);
    }
    expect(ICONS['mark-h']).toMatch(/mk-bg-h/);
    expect(ICONS['mark-s']).toMatch(/mk-bg-s/);
    const css = read('src/styles/global.css');
    for (const c of ['mk-bg-h', 'mk-bg-s', 'mk-ink', 'mk-fill', 'mk-x']) expect(css, c).toContain(c);
  });
  it('the footer uses the Icon component and opens other sites safely (no emoji, no symbol, noopener)', () => {
    const f = read('src/components/Footer.astro');
    expect(f).toMatch(/<Icon name=\{p\.icon\}/);
    expect(f).toMatch(/<Icon name=\{s\.icon\}/);
    expect(f).toContain('rel="noopener"');
    expect(f).toContain('rel="me noopener noreferrer"');
    expect(f).toMatch(/aria-label="Our other projects"/);
    expect(f).toMatch(/aria-label="Follow us"/);
  });
  it('the footer gets no ad or analytics code', () => {
    expect(read('src/components/Footer.astro')).not.toMatch(/adsterra|adsClient|AdLoader|Beacon|Trending/i);
  });
});
