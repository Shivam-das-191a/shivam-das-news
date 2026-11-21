import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS
import { TONES } from '../../public/admin/js/hosting-result.js';

// Phase 3c Part 3c-8d (v0.101.56): the style of the pictures list that hosting-screen.js draws.
const css = readFileSync('public/admin/admin.css', 'utf8');
const screen = readFileSync('public/admin/js/hosting-screen.js', 'utf8');
const MARK = '/* Pictures list of auto image hosting';
const at = css.indexOf(MARK);
const block = at >= 0 ? css.slice(at) : '';

const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const full = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
const vars = (src: string) => Object.fromEntries([...src.matchAll(/--([a-z]+):(#[0-9a-f]{3}(?:[0-9a-f]{3})?)(?![0-9a-f])/gi)].map((m) => [m[1], full(m[2])]));
const lightVars = vars(css.split('\n')[0]);
const darkVars = { ...lightVars, ...vars(css.split('\n')[1]) };

describe('pictures list style (Phase 3c Part 3c-8d)', () => {
  it('has its own marked block at the end of admin.css', () => {
    expect(at).toBeGreaterThan(0);
    expect(css.indexOf(MARK, at + 1)).toBe(-1);
  });
  it('styles every class that hosting-screen.js draws', () => {
    for (const name of ['hosting-result', 'hosting-list', 'hosting-row', 'row-actions']) {
      expect(screen, name).toContain(name);
      expect(block, name).toContain('.' + name);
    }
  });
  it('has a rule for every tone that hosting-result.js can give', () => {
    const tones = [...new Set(Object.values(TONES) as string[])];
    expect(tones.length).toBeGreaterThanOrEqual(4);
    for (const t of tones) expect(block, t).toMatch(new RegExp(`\\.hosting-row\\.${t}\\b`));
  });
  it('uses colour variables only, no fixed colour', () => {
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(block).not.toMatch(/\brgba?\(/i);
  });
  it('keeps the hidden attribute working and puts that rule last', () => {
    const rule = '.hosting-result [hidden]{display:none}';
    expect(block).toContain(rule);
    expect(block.lastIndexOf(rule)).toBeGreaterThan(block.lastIndexOf('display:flex'));
    expect(block.lastIndexOf(rule)).toBeGreaterThan(block.lastIndexOf('display:grid'));
  });
  it('has a narrow screen rule so the buttons are easy to press', () => {
    expect(block).toMatch(/@media\(max-width:480px\)\{\.hosting-result \.row-actions button\{flex:1 1 100%\}\}/);
  });
  it('label colours keep 4.5:1 on the row (card) and the status colour on the box (bg), light and dark', () => {
    expect(block).toMatch(/\.hosting-result\{[^}]*background:var\(--bg\)/);
    expect(block).toMatch(/\.hosting-row\{[^}]*background:var\(--card\)/);
    for (const [mode, v] of [['light', lightVars], ['dark', darkVars]] as const) {
      for (const fg of ['good', 'warn', 'bad']) {
        expect(v[fg], `${mode} ${fg}`).toBeTruthy();
        expect(ratio(v[fg], v.card), `${mode} ${fg} on card`).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio(v.bad, v.bg), `${mode} bad on bg`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(v.mute, v.card), `${mode} mute on card`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('the block holds no emoji', () => {
    expect(/[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u.test(block)).toBe(false);
  });
});
