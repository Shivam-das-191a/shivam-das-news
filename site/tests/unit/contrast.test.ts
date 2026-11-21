import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// v0.2.2: every accent colour in global.css must keep 4.5:1 (WCAG AA). Fails the build if someone picks a weak colour.
const css = fs.readFileSync('src/styles/global.css', 'utf8').split('\n');
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('accent colour contrast', () => {
  it('fill colours keep 4.5:1 with white text', () => {
    const fills = css.flatMap((l) => [...l.matchAll(/--acc:(#[0-9a-f]{6})/gi)].map((m) => m[1]));
    expect(fills.length).toBeGreaterThanOrEqual(5);
    for (const f of fills) expect(ratio(f, '#ffffff'), f).toBeGreaterThanOrEqual(4.5);
  });
  it('accent text keeps 4.5:1 on its own background (light and dark)', () => {
    let light = 0, dark = 0;
    for (const l of css) for (const m of l.matchAll(/--acc-t:(#[0-9a-f]{6})/gi)) {
      if (/dark/.test(l)) { dark++; expect(ratio(m[1], '#16213f'), m[1]).toBeGreaterThanOrEqual(4.5); expect(ratio(m[1], '#101a3a'), m[1]).toBeGreaterThanOrEqual(4.5); }
      else { light++; expect(ratio(m[1], '#ffffff'), m[1]).toBeGreaterThanOrEqual(4.5); }
    }
    expect(light).toBeGreaterThanOrEqual(5);
    expect(dark).toBeGreaterThanOrEqual(9);
  });
});
