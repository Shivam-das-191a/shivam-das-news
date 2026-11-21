import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

describe('heading order of the templates (v0.101.113)', () => {
  const header = read('src/components/Header.astro');
  const card = read('src/components/PostCard.astro');
  const listing = read('src/components/Listing.astro');
  const css = read('src/styles/global.css');

  it('the menu drawer has no heading tag, so a page starts with its h1', () => {
    expect(header).not.toMatch(/<h[1-6][\s>]/);
    expect(header).toContain('<p class="menu-h">Categories</p>');
    expect(header).toContain('<p class="menu-h" id="menu-style">Colour style</p>');
  });

  it('the colour buttons are a named group', () => {
    expect(header).toContain('role="group" aria-labelledby="menu-style"');
  });

  it('the drawer titles keep their look under the new class', () => {
    expect(css).toMatch(/\.menu \.menu-h\{font:700 13px\/1\.2 var\(--fh\);text-transform:uppercase;letter-spacing:\.08em;color:var\(--muted\);margin:0 0 8px\}/);
    expect(css).not.toContain('.menu h3');
  });

  it('a post card is an h3 by default and an h2 when level is 2', () => {
    expect(card).toContain('level = 3');
    expect(card).toContain("const Title = level === 2 ? 'h2' : 'h3';");
    expect(card).toContain('<Title>{d.title}</Title>');
    expect(card).not.toMatch(/<h[1-6][\s>]/);
  });

  it('the listing pages (category, tag, author) put the cards at level 2, right under the h1', () => {
    expect(listing).toContain('<PostCard post={p} level={2} />');
    expect(listing).toContain('<h1>{title}</h1>');
  });

  it('both card levels have the same look', () => {
    expect(css).toContain('.post h3,.post h2{font-size:18px;margin:10px 0 4px}');
  });

  it('the home page and the 404 page keep the default level 3 under their h2 sections', () => {
    for (const p of ['src/pages/index.astro', 'src/pages/404.astro', 'src/components/Related.astro']) {
      expect(read(p)).not.toContain('level={2}');
    }
  });
});
