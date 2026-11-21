// Live SEO score (PLAN 5.3). Pure: takes the post fields, returns a 0 to 100 score and a checklist.
import { slugify } from './slug.js';
import { lintHeadings, clickbaitWarning, wordCount, plainText } from './text.js';

const INTERNAL = /\]\((\/[^)]*|https?:\/\/[^)]*\/[^)]*)\)/g;

export function analyze(p) {
  const body = p.body || '';
  const text = plainText(body);
  const words = wordCount(text);
  const title = (p.title || '').trim();
  const desc = (p.description || '').trim();
  const kw = (p.focusKeyword || '').trim().toLowerCase();
  const paras = text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const first = (paras[0] || '').toLowerCase();
  const checks = [];
  const add = (id, weight, status, label, hint = '') => checks.push({ id, weight, status, label, hint });

  const tl = title.length;
  add('title', 2, tl >= 30 && tl <= 60 ? 'good' : tl >= 20 && tl <= 70 ? 'warn' : 'bad', `Title length: ${tl} characters`, 'Aim for 30 to 60 characters.');
  const dl = desc.length;
  add('desc', 2, dl >= 120 && dl <= 160 ? 'good' : dl >= 50 && dl <= 160 ? 'warn' : 'bad', `Meta description: ${dl} characters`, 'Aim for 120 to 160 characters (50 to 160 is required to publish).');

  if (!kw) add('kw', 1, 'warn', 'No focus keyword', 'Add one to check title, slug, description and first paragraph.');
  else {
    const slugWords = slugify(kw).split('-').filter(Boolean);
    add('kw-title', 1, title.toLowerCase().includes(kw) ? 'good' : 'warn', 'Keyword in title');
    add('kw-desc', 1, desc.toLowerCase().includes(kw) ? 'good' : 'warn', 'Keyword in meta description');
    add('kw-first', 1, first.includes(kw) ? 'good' : 'warn', 'Keyword in first paragraph');
    add('kw-slug', 1, slugWords.length && slugWords.every((w) => (p.permalink || '').split('-').includes(w)) ? 'good' : 'warn', 'Keyword in permalink');
  }

  add('image', 2, p.image ? 'good' : 'bad', p.image ? 'Featured image set' : 'No featured image', 'Required to publish.');
  add('alt', 1, p.image ? (p.imageAlt ? 'good' : 'bad') : 'warn', p.imageAlt ? 'Image alt text set' : 'Image alt text missing');
  if (p.image) {
    const w = p.imageWidth;
    add('img-w', 2, w == null ? 'warn' : w >= 1200 ? 'good' : 'bad', w == null ? 'Image width not checked yet' : `Image is ${w} px wide`, 'Google Discover needs 1200 px or more.');
    if (p.imageWidth && p.imageHeight) {
      const r = p.imageWidth / p.imageHeight;
      add('img-r', 1, Math.abs(r - 16 / 9) < 0.18 ? 'good' : 'warn', `Image ratio ${r.toFixed(2)}:1`, '16:9 is best for Discover and social cards.');
    }
  }

  const internal = (body.match(INTERNAL) || []).length;
  const external = (body.match(/\]\(https?:\/\/[^)]+\)/g) || []).length - (body.match(/\]\(https?:\/\/[^)]*\/[^)]*\)/g) || []).length;
  add('internal', 1, internal >= 1 ? 'good' : 'warn', `${internal} internal link${internal === 1 ? '' : 's'}`, 'Link to at least one related story.');
  add('external', 1, /\]\(https?:\/\/[^)]+\)/.test(body) ? 'good' : 'warn', 'Link to a source', external >= 0 ? 'Cite a source where you can.' : '');

  add('words', 2, words >= 400 ? 'good' : words >= 300 ? 'warn' : 'bad', `${words} words`, '400+ for news, 800+ for evergreen. Under 300 is thin.');

  if (words > 0) {
    const sentences = text.split(/[.!?]+\s/).map((s) => s.trim()).filter(Boolean);
    const avg = sentences.length ? words / sentences.length : 0;
    add('sent', 1, avg <= 20 ? 'good' : avg <= 25 ? 'warn' : 'bad', `Average sentence: ${avg.toFixed(1)} words`, 'Shorter sentences read better on phones.');
    const long = paras.filter((x) => wordCount(x) > 120).length;
    add('para', 1, long === 0 ? 'good' : 'warn', long ? `${long} paragraph${long > 1 ? 's' : ''} over 120 words` : 'Paragraph length is fine');
  }

  const hl = lintHeadings(body);
  add('headings', 2, hl.length ? 'bad' : 'good', hl.length ? `Heading problem: ${hl[0]}` : 'Heading order is correct', 'The title is the only H1; body headings start at H2.');
  const cb = clickbaitWarning(title);
  add('bait', 1, cb ? 'warn' : 'good', cb ? `Headline: ${cb}` : 'Headline is not clickbait');

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + c.weight * (c.status === 'good' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
  return { score: Math.round((got / total) * 100), checks, words };
}

/** Same cut rule as src/lib/seo.ts truncate(), used by the Google preview. */
export function truncate(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(' ');
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,.;:-]+$/, '') + '\u2026';
}
