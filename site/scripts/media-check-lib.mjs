// Part 8v (POLISH, Accessibility): every video and audio of a built page can be controlled, is safe to load and (video) has captions.
// Pure function, no files, no network.
//   checkMedia(html): { errors, warnings }
//   errors:   a video or audio that plays by itself with sound (autoplay without muted; audio with autoplay at all); a video or audio with no controls that is not a silent
//             looping picture (autoplay, muted and loop); a source on http:// (mixed content)
//   warnings: a video with no track of kind captions or subtitles; a video or audio with no preload (the browser may download all of it); a video with no poster;
//             a video with no width and height (and no aspect-ratio in its style)
// Left out on purpose, so there is no false alarm: a hidden element (hidden, aria-hidden="true"); amp-video and amp-audio (other tags); media made by a script;
// text inside script, style, template and comments; a muted, looping autoplay video with no controls (a silent moving picture, WCAG allows it under 5 seconds or with a pause control, which the owner must judge).
// Why: sound that starts alone covers a screen reader's voice (WCAG 1.4.2); a video with no controls cannot be stopped from the keyboard; people who cannot hear need captions (WCAG 1.2.2).
// The site allows audio and video from its own files in a post (PLAN 37).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const MEDIA = /<(video|audio)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/\1\s*>/gi;
const SRC = /<source(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const TRACK = /<track(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const has = (text, name) => new RegExp(`\\s${name}(?=[\\s=>/]|$)`, 'i').test(text) && attr(text, name) !== 'false';
const short = (s) => (s.length > 80 ? s.slice(0, 77) + '...' : s);

export function checkMedia(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(MEDIA)) {
    const kind = m[1].toLowerCase();
    const a = ' ' + m[2].trim();
    const body = m[3];
    if (has(a, 'hidden')) continue;
    if ((attr(a, 'aria-hidden') || '').trim().toLowerCase() === 'true') continue;
    const own = (attr(a, 'src') || '').trim();
    const srcs = [own, ...[...body.matchAll(SRC)].map((s) => (attr(' ' + s[1].trim(), 'src') || '').trim())].filter(Boolean);
    const name = srcs[0] ? short(srcs[0]) : '(no address)';
    const auto = has(a, 'autoplay'), muted = has(a, 'muted'), loop = has(a, 'loop'), controls = has(a, 'controls');
    if (auto && (kind === 'audio' || !muted)) errors.push(`the ${kind} ${name} plays by itself with sound; remove autoplay (or, for a silent video, add muted)`);
    if (!controls && !(kind === 'video' && auto && muted && loop)) errors.push(`the ${kind} ${name} has no controls; the reader cannot play or pause it`);
    for (const s of srcs) if (/^http:\/\//i.test(s)) errors.push(`the ${kind} loads ${short(s)} over http://; use https://`);
    const preload = (attr(a, 'preload') || '').trim().toLowerCase();
    if (preload !== 'none' && preload !== 'metadata') warnings.push(`the ${kind} ${name} has no preload="metadata" (or none); the browser may download all of it`);
    if (kind === 'video') {
      const tracks = [...body.matchAll(TRACK)].map((t) => (attr(' ' + t[1].trim(), 'kind') || '').trim().toLowerCase());
      const silent = auto && muted && loop && !controls;
      if (!silent && !tracks.some((k) => k === 'captions' || k === 'subtitles')) warnings.push(`the video ${name} has no <track kind="captions">; people who cannot hear need captions`);
      if (!(attr(a, 'poster') || '').trim()) warnings.push(`the video ${name} has no poster picture`);
      if (!(attr(a, 'width') && attr(a, 'height')) && !/aspect-ratio/i.test(attr(a, 'style') || '')) warnings.push(`the video ${name} has no width and height (or aspect-ratio); the page may jump while it loads`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
