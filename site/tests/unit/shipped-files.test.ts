import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The Worker settings files stay free of secret values, whatever the owner has filled in (T-0006).
const toml = (w: string) => readFileSync(new URL('../../../workers/' + w + '/wrangler.toml', import.meta.url), 'utf8');

describe('real wrangler.toml files', () => {
  for (const w of ['analytics', 'contact', 'push']) {
    it(`${w}: has the DB binding and no secret value written in it`, () => {
      const t = toml(w);
      expect(t).toMatch(/binding = "DB"/);
      expect(t).not.toMatch(/^\s*[A-Z_]*SECRET\s*=\s*"/m);
      expect(t).not.toMatch(/PRIVATE/);
    });
  }
});
