// Part 8ag (POLISH, HTML quality): no tag of a built page repeats an attribute, and no tag is one that HTML has dropped.
// A browser keeps the FIRST copy of a repeated attribute and silently ignores the rest, so class="a" class="b" shows only "a" and the style the writer meant is lost.
// A few old tags (marquee, blink, frame, frameset, applet ...) are no longer part of HTML and do nothing useful today. Pure function, no files, no network.
//   checkTags(html): { errors, warnings }
//   errors:   a tag that has the same attribute twice (the name is read without regard to case); a tag HTML has dropped and browsers no longer run as it was meant
//             (marquee, blink, frame, frameset, noframes, applet, bgsound, isindex, plaintext, xmp, listing, keygen, menuitem, noembed, spacer, command, nextid)
//   warnings: an old presentation tag that still shows but should be CSS (center, font, big, strike, tt, acronym, nobr, basefont, dir, rb, rtc);
//             an old presentation attribute (align, valign, bgcolor, cellpadding, cellspacing, hspace, vspace)
// Left out on purpose, so there is no false alarm: everything inside svg and math (SVG has its own font and similar tags), text inside script, style, template and comments,
//   custom elements with a hyphen in the name (my-tag), data-, aria- and other names that only end with a word of the lists, the case of a tag or an attribute,
//   and a closing tag such as </center> (only the opening tag is reported, so one slip is one message).
// Why: a post written by hand (PLAN 37) or an old Blogger post (PLAN 11) can carry <center>, <font> or a repeated class, and the owner cannot see that from the page.
const SKIP = /<(script|style|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const DROPPED = new Set(['marquee', 'blink', 'frame', 'frameset', 'noframes', 'applet', 'bgsound', 'isindex', 'plaintext', 'xmp', 'listing', 'keygen', 'menuitem', 'noembed', 'spacer', 'command', 'nextid']);
const OLD_TAGS = new Set(['center', 'font', 'big', 'strike', 'tt', 'acronym', 'nobr', 'basefont', 'dir', 'rb', 'rtc']);
const OLD_ATTRS = new Set(['align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'hspace', 'vspace']);
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

export function checkTags(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    if (tag.includes('-')) continue; // a custom element: its own rules
    if (DROPPED.has(tag)) errors.push(`a <${tag}> tag is no longer part of HTML and browsers do not run it as it was meant; remove it`);
    else if (OLD_TAGS.has(tag)) warnings.push(`a <${tag}> tag is old HTML; use CSS or a current tag instead`);
    const seen = new Set(), twice = new Set();
    for (const a of m[2].matchAll(ATTR)) {
      const name = a[1].toLowerCase();
      if (seen.has(name)) twice.add(name); else seen.add(name);
    }
    for (const name of twice) errors.push(`a <${tag}> has the attribute ${short(name)} twice; the browser keeps the first and ignores the second`);
    for (const name of seen) if (OLD_ATTRS.has(name)) warnings.push(`a <${tag}> has the old attribute ${name}; use CSS instead`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
