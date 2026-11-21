// Mirrors the build rules in src/content.config.ts, src/lib/gate.ts and src/lib/headings.ts,
// so the editor stops a bad post before it can break the build.
import { SLUG_RE } from './slug.js';
import { lintHeadings, clickbaitWarning, wordCount } from './text.js';

export const MIN_IMAGE_WIDTH = 1200;
// v0.95.0 (push part 7e-1): the notification fields of PLAN 31.5. The same limits and the same emoji pattern as src/content.config.ts.
export const PUSH_VALUES = ['auto', 'off', 'force'];
export const PUSH_TITLE_MAX = 70;
export const PUSH_BODY_MAX = 120;
const NOTE_EMOJI = /(?![\u00A9\u00AE\u2122])(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}])/u;

export function validatePost(d, body, ctx = {}) {
  const errors = [];
  const warnings = [];
  const publishing = d.status === 'published';
  if (!d.title || d.title.trim().length < 5) errors.push('Title needs at least 5 characters.');
  if (!SLUG_RE.test(d.permalink || '')) errors.push('Permalink: lowercase letters, numbers and hyphens only.');
  if (!SLUG_RE.test(d.category || '')) errors.push('Pick a category (lowercase letters, numbers, hyphens).');
  if (ctx.takenPermalinks && ctx.takenPermalinks.has(d.permalink)) errors.push(`Permalink "${d.permalink}" is already used by another post (permalinks are unique site-wide).`);
  if ((d.description || '').length > 160) errors.push('Meta description is over 160 characters.');
  if (!SLUG_RE.test(d.author || '')) errors.push('Pick an author.');
  if (d.push !== undefined && d.push !== '' && !PUSH_VALUES.includes(d.push)) errors.push('Push: choose auto, off or force.');
  if ((d.pushTitle || '').length > PUSH_TITLE_MAX) errors.push(`Notification title is over ${PUSH_TITLE_MAX} characters.`);
  if ((d.pushBody || '').length > PUSH_BODY_MAX) errors.push(`Notification text is over ${PUSH_BODY_MAX} characters.`);
  if (NOTE_EMOJI.test(`${d.pushTitle || ''} ${d.pushBody || ''}`)) errors.push('The notification text must not contain emoji (icons are SVG only).');
  const bad = lintHeadings(body || '');
  if (bad.length) errors.push('Headings: ' + bad.join('; '));
  if (publishing) {
    if ((d.description || '').length < 50) errors.push('Meta description needs 50 to 160 characters to publish.');
    if (!d.image) errors.push('A featured image is required to publish.');
    if (d.image && !d.imageAlt) errors.push('Featured image needs alt text to publish.');
    if (d.image && ctx.imageWidth != null && ctx.imageWidth < MIN_IMAGE_WIDTH)
      errors.push(`Featured image is ${ctx.imageWidth} px wide; Google Discover needs ${MIN_IMAGE_WIDTH}+ px.`);
    if (d.image && ctx.imageWidth == null) warnings.push(`Could not check the image width (it needs ${MIN_IMAGE_WIDTH}+ px for Google Discover).`);
    if (ctx.timeZoneBlocked) errors.push('Confirm the publisher time zone in Settings first. Post URLs contain the date and are permanent.');
    const c = clickbaitWarning(d.title || '');
    if (c) warnings.push(c);
    const w = wordCount(body || '');
    if (w < 300) warnings.push(`Only ${w} words (news posts should be 300+).`);
    if (!/\]\((\/|https?:\/\/[^)]*\/)[^)]*\)/.test(body || '')) warnings.push('No internal link in the body.');
  }
  return { errors, warnings };
}
