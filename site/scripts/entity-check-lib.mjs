// Part 8ai (POLISH, HTML quality): the character references of a built page (&amp; &nbsp; &#8217;) are written so that readers see the real character.
// The classic slip is an ampersand escaped twice: the page holds &amp;amp; and the reader sees the code "&amp;" in the headline. A numeric reference to a character that does not exist
// (&#0; &#xD800; &#1114112;) is replaced by a question mark box. Pure function, no files, no network.
//   checkEntities(html): { errors, warnings }
//   errors:   in the text of a page, a common reference escaped twice (&amp;amp; &amp;nbsp; &amp;#8217;);
//             anywhere in a page, a numeric reference that is empty (&#; &#x;), is 0, is in the surrogate range D800 to DFFF or is above 10FFFF
//   warnings: in the text of a page, a common name with no semicolon (&nbsp &mdash &copy), which shows as plain text or is a parse error;
//             a numeric reference to a control character or an old Windows code (1 to 8, 11, 14 to 31, 127 to 159), which browsers repair but should be the real character
// Left out on purpose, so there is no false alarm: text inside pre, code, kbd, samp, textarea and xmp (a writer who shows "&amp;" in a code sample must write &amp;amp; there);
//   text inside script, style, template and comments; a name with no semicolon inside an attribute value such as a web address (?a=1&copy=2); a lone ampersand;
//   a name that is not in the common list (the full HTML list has more than 2000 names); an ampersand and hash with no digits and no semicolon (&#top in a web address); the case of the digits and of the x in a hex reference.
// Why: a post written by hand (PLAN 37) or an old Blogger post (PLAN 11) can carry &amp;amp; or &#146; and the owner cannot see it in the dashboard preview.
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const CODE = /<(pre|code|kbd|samp|textarea|xmp)(?=[\s>/])[\s\S]*?<\/\1\s*>/gi;
const TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:"[^"]*"|'[^']*'|[^'">])*>/g;
const NAMES = 'amp|lt|gt|quot|apos|nbsp|copy|reg|trade|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo|sbquo|bdquo|laquo|raquo|bull|middot|euro|pound|yen|cent|deg|times|divide|plusmn|frac12|para|sect|eacute|egrave|agrave|ccedil|ntilde|uuml|ouml|auml';
const TWICE = new RegExp(`&amp;(?:(?:${NAMES});|#\\d{1,7};|#[xX][0-9a-fA-F]{1,6};)`, 'g');
const NO_SEMI = new RegExp(`&(?:${NAMES})(?![a-zA-Z0-9;=])`, 'g');
const NUMERIC = /&#(?:([xX][0-9a-fA-F]+|\d+);?|[xX]?;)/g;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

export function checkEntities(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const all = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '').replace(CODE, ' ');
  const text = all.replace(TAG, ' ');
  for (const m of text.matchAll(TWICE))
    errors.push(`the text holds ${short(m[0])}, a character escaped twice, so readers see the code and not the character; write it once (${short('&' + m[0].slice(5))})`);
  for (const m of text.matchAll(NO_SEMI))
    warnings.push(`the text holds ${short(m[0])} with no semicolon, so it can show as plain text; write ${short(m[0])};`);
  for (const m of all.matchAll(NUMERIC)) {
    const ref = m[0];
    const digits = m[1];
    if (digits === undefined) { errors.push(`a character reference ${short(ref)} has no number`); continue; }
    const n = /^[xX]/.test(digits) ? parseInt(digits.slice(1), 16) : parseInt(digits, 10);
    if (n === 0) errors.push(`a character reference ${short(ref)} is the null character, which a browser replaces with a question mark box`);
    else if (n >= 0xd800 && n <= 0xdfff) errors.push(`a character reference ${short(ref)} is in the surrogate range, which is not a real character`);
    else if (n > 0x10ffff) errors.push(`a character reference ${short(ref)} is above the last real character (10FFFF)`);
    else if ((n >= 1 && n <= 8) || n === 11 || (n >= 14 && n <= 31) || (n >= 127 && n <= 159))
      warnings.push(`a character reference ${short(ref)} is a control character or an old Windows code; write the real character instead`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
