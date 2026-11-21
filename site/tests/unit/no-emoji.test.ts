// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore plain JS
import { findEmoji, findIconGlyphs, decodeEntities, codePoints } from '../../scripts/no-emoji-lib.mjs';
import { ICONS } from '../../src/lib/svg-icons';
// @ts-ignore plain JS
import { ICONS as ADMIN_ICONS, icon } from '../../public/admin/js/ui.js';

function walk(dir: string, ok: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.astro' || name === 'pagefind') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ok, out);
    else if (ok(p)) out.push(p);
  }
  return out;
}

describe('the emoji finder (PLAN 29.3)', () => {
  it('finds emojis, emoji symbols, keycaps and flags', () => {
    for (const t of ['\u{1F600}', '\u26A0\uFE0F', '\u2705', '\u2764', '1\uFE0F\u20E3', '\u{1F1EE}\u{1F1F3}', '\u2B50', '\u{1F44D}\u{1F3FD}']) expect(findEmoji(t).length, codePoints([...t])).toBeGreaterThan(0);
  });
  it('finds symbols hidden in HTML entities', () => {
    expect(findEmoji('<p>&#9888;</p>').length).toBeGreaterThan(0);
    expect(findEmoji('<p>&#x1F600;</p>').length).toBeGreaterThan(0);
    expect(findEmoji('&hearts;').length).toBeGreaterThan(0);
    expect(decodeEntities('&#9680; &amp; &rarr;')).toBe('\u25D0 &amp; \u2192');
  });
  it('lets plain text through: signs, quotes, dashes, rupee, digits, Bengali with joiners', () => {
    for (const t of ['\u00A9 2026 Shivam Das News', 'Brand\u2122 and Name\u00AE', 'caf\u00E9 \u2014 \u201Cquoted\u201D \u2022 \u20B9500', 'a \u00B7 b', 'Page 1 of 3, 2026-11-15', 'বাংলা সংবাদ', 'র\u200D\u09CD\u09AFাব', 'ক\u200C\u09CDষ']) expect(findEmoji(t), t).toEqual([]);
  });
  it('the strict finder also catches arrows and shapes used as icons, but not text', () => {
    for (const t of ['\u2192', '\u25D0', '\u22EE', '\u2315', '&larr; Newer', '&#9680;']) expect(findIconGlyphs(t).length, t).toBeGreaterThan(0);
    expect(findIconGlyphs('\u00A9 caf\u00E9 \u2014 \u201Cx\u201D \u2022 \u20B9')).toEqual([]);
  });
});

describe('the project has no emojis', () => {
  const root = process.cwd(); // site/
  const top = join(root, '..');
  const isText = (p: string) => /\.(astro|ts|js|mjs|json|css|html|md|toml|yml|svg|txt|xml|sql|webmanifest)$/.test(p) && !p.endsWith('package-lock.json');
  it('templates, scripts, the dashboard and the design preview use no emoji and no symbol-as-icon', () => {
    const files = [
      ...walk(join(root, 'src'), isText),
      ...walk(join(root, 'public'), isText),
      ...walk(join(root, 'scripts'), (p) => isText(p) && !p.endsWith('no-emoji-lib.mjs')),
      ...walk(join(top, 'theme'), isText),
      ...walk(join(top, 'workers'), isText),
      ...walk(join(top, '.github'), isText),
    ];
    expect(files.length).toBeGreaterThan(50);
    const bad = files.map((f) => [f, findIconGlyphs(readFileSync(f, 'utf8'))] as const).filter(([, c]) => c.length).map(([f, c]) => `${f}: ${codePoints(c)}`);
    expect(bad).toEqual([]);
  });
  it('content, config and the plan files (.md) use no emoji', () => {
    const files = [
      ...walk(join(root, 'content'), isText),
      ...walk(join(root, 'config'), isText),
      ...readdirSync(top).filter((n) => n.endsWith('.md')).map((n) => join(top, n)),
      join(root, 'README.md'),
    ];
    const bad = files.map((f) => [f, findEmoji(readFileSync(f, 'utf8'))] as const).filter(([, c]) => c.length).map(([f, c]) => `${f}: ${codePoints(c)}`);
    expect(bad).toEqual([]);
  });
});

describe('the SVG icons', () => {
  it('every <Icon name="..."> in a template exists', () => {
    const used = new Set<string>();
    for (const f of walk(join(process.cwd(), 'src'), (p) => p.endsWith('.astro'))) for (const m of readFileSync(f, 'utf8').matchAll(/<Icon\s+name="([^"]+)"/g)) used.add(m[1]);
    expect(used.size).toBeGreaterThan(0);
    for (const n of used) expect(Object.keys(ICONS), n).toContain(n);
  });
  it('icons are plain drawings: no script, no event handler, no link, no image, no fixed colour', () => {
    for (const [n, body] of Object.entries({ ...ICONS, ...ADMIN_ICONS }) as [string, string][]) {
      expect(body, n).not.toMatch(/<script|on\w+=|href|<image|<foreignObject|#[0-9a-fA-F]{3,6}\b|rgb\(/i);
      expect(findIconGlyphs(body), n).toEqual([]);
    }
  });
  it('the dashboard copies are the same drawings as the site', () => {
    for (const [n, body] of Object.entries(ADMIN_ICONS)) expect((ICONS as any)[n], n).toBe(body);
  });
  it('the dashboard icon is a decorative SVG; an unknown name fails loudly', () => {
    const s = icon('alert', 18);
    expect(s.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(s.getAttribute('width')).toBe('18');
    expect(s.querySelectorAll('path').length).toBe(3);
    expect(() => icon('smile')).toThrow(/does not exist/);
  });
});
