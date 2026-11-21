import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error plain JS module without types
import { splitSections, versionOf, plan, rebuildMain, archiveText, archivePath, verifyLossless, isOpenItems, isChangelogEntry, wordsOf } from '../../scripts/archive-docs-lib.mjs';

const INCOMPLETE = `# INCOMPLETE.md: Open Items and Gaps

Intro words here.

## Decisions Still Needed
| 1 | Domain | later |

## Open Items After v0.3.0
- newest block, three words.

## Open Items After v0.2.0
- second block.

## Open Items After v0.1.1
- third block, old.

\`\`\`
## not a heading inside a code fence
\`\`\`

## Open Items After v0.1.0
- fourth block, oldest.
`;
const CHANGELOG = `# CHANGELOG.md

Newest first.

## 0.3.0 (2026-11-16): third

Text three.

## 0.2.0 (2026-11-15): second

Text two.

## 0.1.0 (2026-11-14): first

Text one.
`;

describe('splitSections', () => {
  it('gives back the exact original from head and sections', () => {
    const s = splitSections(INCOMPLETE);
    expect(s.head + s.sections.map((x: any) => x.text).join('')).toBe(INCOMPLETE);
    expect(s.sections.map((x: any) => x.heading)).toEqual(['## Decisions Still Needed', '## Open Items After v0.3.0', '## Open Items After v0.2.0', '## Open Items After v0.1.1', '## Open Items After v0.1.0']);
  });
  it('does not split on a heading inside a code fence', () => {
    const s = splitSections(INCOMPLETE);
    expect(s.sections[3].text).toContain('## not a heading inside a code fence');
  });
  it('a text with no headings is all head', () => {
    expect(splitSections('just text\n')).toEqual({ head: 'just text\n', sections: [] });
  });
});

describe('versionOf and the movable tests', () => {
  it('reads both heading shapes', () => {
    expect(versionOf('## Open Items After v0.101.6')).toBe('v0.101.6');
    expect(versionOf('## 0.101.6 (2026-11-16): title')).toBe('v0.101.6');
    expect(versionOf('## Decisions Still Needed')).toBe('');
  });
  it('knows which sections may move', () => {
    expect(isOpenItems({ heading: '## Open Items After v0.1.0' })).toBe(true);
    expect(isOpenItems({ heading: '## Decisions Still Needed' })).toBe(false);
    expect(isChangelogEntry({ heading: '## 0.1.0 (x)' })).toBe(true);
    expect(isChangelogEntry({ heading: '## Rules' })).toBe(false);
  });
});

describe('plan keeps the newest and moves the rest, in order', () => {
  it('INCOMPLETE: keeps decisions and the newest two blocks', () => {
    const p = plan(INCOMPLETE, isOpenItems, 2);
    expect(p.kept.map((s: any) => s.heading)).toEqual(['## Decisions Still Needed', '## Open Items After v0.3.0', '## Open Items After v0.2.0']);
    expect(p.moved.map((s: any) => s.heading)).toEqual(['## Open Items After v0.1.1', '## Open Items After v0.1.0']);
    expect(p.range).toBe('v0.1.0-v0.1.1');
  });
  it('CHANGELOG: keeps the newest entry', () => {
    const p = plan(CHANGELOG, isChangelogEntry, 1);
    expect(p.kept).toHaveLength(1);
    expect(p.moved).toHaveLength(2);
    expect(p.range).toBe('v0.1.0-v0.2.0');
  });
  it('nothing moves when there are few enough', () => {
    const p = plan(CHANGELOG, isChangelogEntry, 5);
    expect(p.moved).toEqual([]);
    expect(rebuildMain(p, 'x')).toBe(CHANGELOG);
  });
});

describe('rebuildMain, archiveText and verifyLossless', () => {
  const p = plan(CHANGELOG, isChangelogEntry, 1);
  const rel = archivePath('CHANGELOG.md', p.range);
  const main = rebuildMain(p, rel);
  const arc = archiveText('CHANGELOG.md', p);
  it('names the archive file by document and range', () => expect(rel).toBe('docs/archive/CHANGELOG-v0.1.0-v0.2.0.md'));
  it('puts a pointer line right after the first line', () => {
    expect(main.split('\n').slice(0, 3)).toEqual(['# CHANGELOG.md', '', 'Older text is in `docs/archive/CHANGELOG-v0.1.0-v0.2.0.md` (moved there without change).']);
    expect(main).toContain('Older text is in `docs/archive/CHANGELOG-v0.1.0-v0.2.0.md`');
    expect(main.indexOf('Older text')).toBeLessThan(main.indexOf('Newest first.'));
  });
  it('keeps the newest entry and drops the old ones from the main file', () => {
    expect(main).toContain('Text three.');
    expect(main).not.toContain('Text two.');
    expect(arc).toContain('Text two.');
    expect(arc).toContain('Text one.');
    expect(arc.indexOf('Text two.')).toBeLessThan(arc.indexOf('Text one.'));
  });
  it('proves nothing was lost', () => expect(verifyLossless(CHANGELOG, p, main, arc)).toEqual([]));
  it('notices a lost section and a word count that does not add up', () => {
    expect(verifyLossless(CHANGELOG, p, main, arc.replace('Text one.', ''))[0]).toMatch(/missing in the archive/);
    expect(verifyLossless(CHANGELOG, p, main.replace('Text three.', ''), arc).join()).toMatch(/kept section is missing/);
    expect(verifyLossless(CHANGELOG + ' extra words', p, main, arc).join()).toMatch(/do not add up/);
  });
});

describe('scripts/archive-docs.mjs in a temporary folder', () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), 'arch-'));
    writeFileSync(join(root, 'INCOMPLETE.md'), INCOMPLETE);
    writeFileSync(join(root, 'CHANGELOG.md'), CHANGELOG);
    return root;
  };
  const run = (root: string, ...more: string[]) => spawnSync('node', ['scripts/archive-docs.mjs', '--root', root, '--keep-incomplete', '2', '--keep-changelog', '1', ...more], { encoding: 'utf8' });

  it('without --apply it changes nothing', () => {
    const root = setup();
    const r = run(root);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/ARCHIVE PLAN ONLY/);
    expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).toBe(CHANGELOG);
    expect(existsSync(join(root, 'docs'))).toBe(false);
    rmSync(root, { recursive: true });
  });
  it('with --apply it writes the archives and the words add up', () => {
    const root = setup();
    const r = run(root, '--apply');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/ARCHIVE DONE/);
    const arc = readFileSync(join(root, 'docs/archive/CHANGELOG-v0.1.0-v0.2.0.md'), 'utf8');
    const main = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    expect(arc).toContain('Text one.');
    expect(main).not.toContain('Text one.');
    const arcI = readFileSync(join(root, 'docs/archive/INCOMPLETE-v0.1.0-v0.1.1.md'), 'utf8');
    expect(arcI).toContain('fourth block, oldest.');
    // the moved text plus the new main (minus the pointer line and the archive header) is the original
    const moved = (CHANGELOG.match(/Text (one|two)\./g) || []).length;
    expect(moved).toBe(2);
    expect(wordsOf(main)).toBeLessThan(wordsOf(CHANGELOG) + 20);
    rmSync(root, { recursive: true });
  });
  it('does not overwrite an archive that already exists', () => {
    const root = setup();
    expect(run(root, '--apply').status).toBe(0);
    writeFileSync(join(root, 'CHANGELOG.md'), CHANGELOG);
    const r = run(root, '--apply');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/already exists/);
    rmSync(root, { recursive: true });
  });
});

describe('the real documents (plan only, nothing is written)', () => {
  it('the dry run on this repository exits 0 and says it only planned', () => {
    const r = spawnSync('node', ['scripts/archive-docs.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/ARCHIVE PLAN ONLY|nothing to move/);
  });
});
