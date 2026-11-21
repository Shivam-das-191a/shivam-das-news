// Part 8bj (POLISH, BUGS U): the alt text of the pictures of a built page says something a person can use.
// img-check-lib.mjs reads whether an alt attribute is there. It does not read what the alt says, so alt="IMG_2041.jpg", alt="image" and a whole paragraph in an alt all passed.
// A screen reader reads the alt aloud and a search engine reads it as the description of the picture, so a file name or a lone word tells nobody anything.
// Pure function, no files, no network.
//   checkAltText(html): { errors, warnings }
//   errors:   an alt that is only a file name (IMG_2041.jpg, photo.png) or a camera or screenshot name (IMG 2041, DSC00123, Screenshot 2026-11-20 at 10.15.22, PXL_20261120_101500)
//   warnings: an alt that is one empty word of its kind (image, picture, photo, graphic, img, pic, thumbnail, banner, placeholder, untitled) or such a word with a number (image 3, photo1); an alt that starts with "image of", "picture of",
//             "photo of", "graphic of" or "screenshot of" (the screen reader says "image" already); an alt over 125 characters (put the long text in a caption); an alt of blanks or
//             marks only (write alt="" for a decoration)
// Read on: every <img> of the page. An alt="" is left alone (it marks a decoration, img-check-lib.mjs allows it); a tag with no alt is left to img-check-lib.mjs. Comments and <script>, <style>,
//   <template> blocks are skipped; the case is not read; &amp; &quot; &#39; &lt; &gt; and &nbsp; are turned into their letters before the alt is read.
// Left out on purpose, so there is no false alarm: any alt that has two or more real words and no file name; "logo" and "icon" (a real name for a logo picture); an alt in an svg; an input of
//   type image and an area (their own checks); the language of the alt.
const SKIP = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const IMG = /<img(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const FILE = /^[^\s/\\]+\.(?:jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic|heif|ico)$/i;
const CAMERA = /^(?:img|dsc|dscn|dscf|pxl|mvimg|screenshot|screen shot)[\s_-]*(?:\d[\s\d_.:-]*|\d{4}-\d{2}-\d{2}.*|\d{8}[_-]\d+.*)$/i;
const LONE = new Set(['image', 'images', 'picture', 'pictures', 'photo', 'photos', 'photograph', 'graphic', 'img', 'pic', 'thumbnail', 'thumb', 'banner', 'placeholder', 'untitled', 'screenshot']);
const NUMBERED = /^(?:image|picture|photo|pic|untitled|figure|fig)[\s_.-]*\d+$/i;
const LEAD = /^(?:an?\s+)?(?:image|picture|photo|photograph|graphic|screenshot)\s+of\b/i;

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=[\\s/>])`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};
const plain = (s) => s.replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

export function checkAltText(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const page = html.replace(SKIP, ' ');
  for (const m of page.matchAll(IMG)) {
    const raw = attr(m[0], 'alt');
    if (raw === null || raw === '') continue;
    const alt = plain(raw).trim();
    const tag = `alt="${short(alt)}"`;
    if (alt === '') { warnings.push('a picture has an alt of blanks only; write alt="" for a picture that is only decoration'); continue; }
    if (!/[\p{L}\p{N}]/u.test(alt)) { warnings.push(`a picture has ${tag}, which holds no letter or number; write alt="" for a decoration`); continue; }
    if (FILE.test(alt) || CAMERA.test(alt)) { errors.push(`a picture has ${tag}, which is a file name; write what the picture shows`); continue; }
    if (LONE.has(alt.toLowerCase().replace(/[.:!]+$/, '')) || NUMBERED.test(alt)) { warnings.push(`a picture has ${tag}, which says nothing about the picture; write what it shows`); continue; }
    if (LEAD.test(alt)) { warnings.push(`a picture has ${tag}; a screen reader already says "image", so start with what it shows`); continue; }
    if ([...alt].length > 125) warnings.push(`a picture has an alt of ${[...alt].length} characters (${tag}); keep it short and put the long text in a caption`);
  }
  return { errors, warnings };
}
