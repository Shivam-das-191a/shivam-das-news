import { describe, it, expect } from 'vitest';
import { lintHeadings } from '../../src/lib/headings';
import { clickbaitWarning, gateWarnings } from '../../src/lib/gate';
import { wordCount, readTime } from '../../src/lib/readtime';

describe('heading linter (bug S1)', () => {
  it('accepts H2 then H3', () => {
    expect(lintHeadings('Intro\n\n## One\n\ntext\n\n### Two\n')).toEqual([]);
  });
  it('rejects an H1 in the body', () => {
    expect(lintHeadings('# Title again\n')).toHaveLength(1);
    expect(lintHeadings('Title\n=====\n')).toHaveLength(1);
    expect(lintHeadings('<h1>x</h1>')).toHaveLength(1);
  });
  it('rejects skipped levels', () => {
    expect(lintHeadings('## A\n\n#### B\n')).toHaveLength(1);
  });
  it('rejects a body that starts at H3', () => {
    expect(lintHeadings('### A\n')).toHaveLength(1);
  });
  it('ignores headings inside code fences', () => {
    expect(lintHeadings('```\n# comment\n```\n## Real\n')).toEqual([]);
  });
});

describe('pre-publish warnings', () => {
  it('flags clickbait', () => {
    expect(clickbaitWarning('You won\'t believe this')).toBeTruthy();
    expect(clickbaitWarning('BREAKING NEWS TODAY here')).toBeTruthy();
    expect(clickbaitWarning('Government passes new budget')).toBeNull();
  });
  it('warns on short posts and missing internal links', () => {
    expect(gateWarnings({ title: 'Fine title', words: 100, hasInternalLink: false })).toHaveLength(2);
    expect(gateWarnings({ title: 'Fine title', words: 500, hasInternalLink: true })).toEqual([]);
  });
});

describe('word count', () => {
  it('counts words and rounds read time up', () => {
    expect(wordCount('one two  three')).toBe(3);
    expect(readTime('word '.repeat(221))).toBe(2);
  });
});
