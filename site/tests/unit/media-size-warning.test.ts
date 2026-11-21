// Part 7ae (BUGS U12): the warning when the pictures folder is near 1 GB.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mediaSizeWarning, MEDIA_WARN_MB } from '../../scripts/validate-content-lib.mjs';

const MB = 1024 * 1024;

describe('mediaSizeWarning', () => {
  it('uses 900 MB as the fixed limit', () => { expect(MEDIA_WARN_MB).toBe(900); });
  it('gives nothing for an empty folder', () => { expect(mediaSizeWarning(0)).toBeNull(); });
  it('gives nothing below the limit', () => { expect(mediaSizeWarning(500 * MB)).toBeNull(); });
  it('gives nothing exactly at the limit', () => { expect(mediaSizeWarning(900 * MB)).toBeNull(); });
  it('warns one byte above the limit', () => { expect(mediaSizeWarning(900 * MB + 1)).toContain('900 MB'); });
  it('names the size, 1 GB and R2 in plain words', () => {
    const w = mediaSizeWarning(950 * MB) as string;
    expect(w).toContain('950 MB');
    expect(w).toContain('1 GB');
    expect(w).toContain('R2');
  });
  it('ignores a value that is not a good number', () => {
    for (const v of [NaN, Infinity, -1, '1000000000', null, undefined, {}]) expect(mediaSizeWarning(v as any)).toBeNull();
  });
  it('accepts another limit for a test, and ignores a bad limit', () => {
    expect(mediaSizeWarning(2 * MB, 1)).not.toBeNull();
    expect(mediaSizeWarning(2 * MB, 0)).toBeNull();
    expect(mediaSizeWarning(2 * MB, NaN)).toBeNull();
  });
  it('has no emoji in the sentence', () => { expect(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(mediaSizeWarning(999 * MB) as string)).toBe(false); });
});

describe('npm run check:content with a big pictures folder', () => {
  const root = () => { const d = mkdtempSync(join(tmpdir(), 'ms-')); mkdirSync(join(d, 'public/media/2026/11'), { recursive: true }); return d; };
  const node = (cwd: string, args: string[] = []) => spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', cwd, ...args], { encoding: 'utf8' });

  it('passes without a warning for a small folder', () => {
    const d = root(); writeFileSync(join(d, 'public/media/2026/11/a.webp'), 'x');
    const r = node(d);
    expect(r.stdout).not.toContain('public/media');
    expect(r.stdout).toContain('CONTENT PASS');
  });
  it('warns but still passes when the folder is above 900 MB (sparse file)', () => {
    const d = root(); const f = join(d, 'public/media/2026/11/big.bin'); writeFileSync(f, ''); truncateSync(f, 901 * MB);
    const r = node(d);
    expect(r.stdout).toContain('WARN  public/media: the pictures in public/media use 901 MB');
    expect(r.stdout).toContain('CONTENT PASS');
    expect(r.status).toBe(0);
  });
  it('adds the sizes of all files in all sub folders', () => {
    const d = root();
    for (const n of ['a.bin', 'b.bin']) { const f = join(d, 'public/media/2026/11', n); writeFileSync(f, ''); truncateSync(f, 460 * MB); }
    expect(node(d).stdout).toContain('use 920 MB');
  });
  it('skips the size check when only some files are named', () => {
    const d = root(); const f = join(d, 'public/media/2026/11/big.bin'); writeFileSync(f, ''); truncateSync(f, 901 * MB);
    expect(node(d, ['content/blogs/none.md']).stdout).not.toContain('public/media');
  });
});
