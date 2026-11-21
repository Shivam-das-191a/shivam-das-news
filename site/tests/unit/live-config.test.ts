import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contactPlan } from '../../src/lib/contact';

/** v0.101.38: the build reads the real config files, so a wrong value in them stops Cloudflare Pages.
 *  This test reads the same files, so the mistake shows up in `npm test` before anything is pushed. */
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../config/${name}`, import.meta.url), 'utf8'));

describe('the real config files the build reads', () => {
  it('contact.json passes the same check the build uses', () => {
    expect(() => contactPlan(read('contact.json'))).not.toThrow();
  });
  it('trap Worker ids are empty or exactly 32 letters or numbers', () => {
    const toml = readFileSync(new URL('../../../workers/trap/wrangler.toml', import.meta.url), 'utf8');
    for (const key of ['CF_ACCOUNT_ID', 'CF_LIST_ID']) {
      const m = toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
      expect(m, key).not.toBeNull();
      expect(m![1] === '' || /^[0-9a-f]{32}$/i.test(m![1]), key).toBe(true);
    }
  });
});
