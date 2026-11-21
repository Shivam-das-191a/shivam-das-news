// Part 8b (POLISH): the loading rules for the pictures of a BUILT page. Pure functions, no files, no network.
//   the top picture must not be lazy and must say fetchpriority="high"   -> error (an article page with a top picture)
//   a picture with fetchpriority="high" must not also be loading="lazy"  -> error (it would load late)
//   more than one picture with fetchpriority="high"                       -> warning (only the top picture should)
//   an article picture that is not the top picture and is not lazy        -> warning (it slows the first view)
// Pictures inside <script>, <style> and <template> are skipped.
import { attrOf } from './img-check-lib.mjs';

const IMG = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const HERO = /<figure\b[^>]*\bclass\s*=\s*(?:"[^"]*\bhero\b[^"]*"|'[^']*\bhero\b[^']*')[^>]*>([\s\S]*?)<\/figure\s*>/i;

const short = (s) => (s.length > 80 ? s.slice(0, 77) + '...' : s);
const nameOf = (tag) => { const s = (attrOf(tag, 'src') || '').trim(); return s ? short(s) : '(no address)'; };
const tagsOf = (html) => (typeof html === 'string' ? html.replace(SKIP, '') : '');

export function checkImgLoading(html, pageType = '') {
  const errors = [], warnings = [];
  const page = tagsOf(html);
  const all = page.match(IMG) || [];
  const is = (tag, name, value) => (attrOf(tag, name) || '').trim().toLowerCase() === value;

  for (const tag of all) if (is(tag, 'fetchpriority', 'high') && is(tag, 'loading', 'lazy')) errors.push(`a picture is both fetchpriority="high" and loading="lazy": ${nameOf(tag)}`);
  const high = all.filter((t) => is(t, 'fetchpriority', 'high'));
  if (high.length > 1) warnings.push(`${high.length} pictures have fetchpriority="high"; only the top picture should`);

  if (pageType === 'article') {
    const hero = HERO.exec(page);
    const heroTag = hero ? (hero[1].match(IMG) || [])[0] : undefined;
    if (heroTag) {
      if (!is(heroTag, 'fetchpriority', 'high')) errors.push(`the top picture has no fetchpriority="high": ${nameOf(heroTag)}`);
      if (is(heroTag, 'loading', 'lazy') && is(heroTag, 'fetchpriority', 'high') === false) errors.push(`the top picture is lazy-loaded: ${nameOf(heroTag)}`);
    }
    for (const tag of all) {
      if (tag === heroTag) continue;
      if (!is(tag, 'loading', 'lazy') && !is(tag, 'fetchpriority', 'high')) warnings.push(`an article picture is not lazy-loaded: ${nameOf(tag)}`);
    }
  }
  return { errors, warnings };
}
