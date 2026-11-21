// Build gate (BUGS.md S1, S3, S6, S8; PLAN section 25): a sound head (head-check-lib.mjs: title, one full canonical, robots, share tags), one H1, no placeholder text, no ads outside articles,
// valid JSON-LD with required fields, canonical and description present, sitemaps list only real pages,
// no emojis on any page (PLAN 29.3: icons are inline SVG only), and the picture rules of img-check-lib.mjs (alt, http, other website, width and height) and of img-priority-lib.mjs (the top picture is not lazy and has fetchpriority high, the other article pictures are lazy) and of img-ratio-lib.mjs (thumbnails are 16:9 and their style keeps aspect-ratio and object-fit) and of page-basics-lib.mjs (lang, viewport, skip link, one main, header and footer) and of landmarks-lib.mjs (the h1 inside main, main not nested, a story page has one article with the h1 inside it) and of side-scroll-lib.mjs (nothing is wider than a 320px phone screen: no fixed width over 320px, pictures capped at 100%) and of zoom-check-lib.mjs (the reader can zoom: no user-scalable=no, no maximum-scale under 2, no touch-action that stops pinch zoom) and of new-tab-lib.mjs (a link that opens a new tab has noopener and says so) and of ids-lib.mjs (no empty, spaced or repeated id; in-page links and aria-controls point to a real id) and of iframe-check-lib.mjs (every iframe has a name and an https address; no lazy loading, no size or no sandbox is a warning) and of table-check-lib.mjs (a table has a valid scope and no th inside a layout table; no th, no caption or an empty th is a warning) and of media-check-lib.mjs (a video or audio has controls and does not play by itself with sound, no http source; no captions, no preload or no poster is a warning) and of href-check-lib.mjs (no empty href, no javascript: or file: address, a mailto: has an address and a tel: a number; href="#", http:// and a bare www address are warnings) and of aria-check-lib.mjs (a real role and real aria- names and values; no aria-hidden on body or on something the Tab key reaches; an empty aria-label, a repeated role or aria-hidden around a link are warnings) and of tabindex-check-lib.mjs (a tabindex is a whole number and not above 0; an accesskey or an onclick on a plain tag with no role is a warning) and of time-check-lib.mjs (every datetime is a real date or time; a time with no datetime and unreadable text is a warning) and of attr-values-lib.mjs (the fixed-choice attributes loading, decoding, fetchpriority, referrerpolicy, crossorigin, form method and enctype and ol type hold a real value; referrerpolicy unsafe-url is a warning) and of rel-check-lib.mjs (a rel word is not a typo of a real one, a link that needs a file has an href, a preload has a real "as"; a font preload with no crossorigin and rel="opener" are warnings) and of input-hints-lib.mjs (autocomplete holds real field names; inputmode, enterkeyhint, autocapitalize, spellcheck, translate, contenteditable, draggable and the wrap of a textarea hold a real value; autocomplete="off" on a password field is a warning) and of srcset-check-lib.mjs (a srcset has real w or x descriptors, never both, never the same one twice, never on http://; a sizes ends with a real length; a w srcset with no sizes and a sizes with no srcset are warnings) and of entity-check-lib.mjs (no ampersand escaped twice such as &amp;amp;, no numeric reference to a character that does not exist; a name with no semicolon and a reference to a control character or an old Windows code are warnings) and of form-behavior-check-lib.mjs (no form that sends to http://, no password field in a GET form; a field with no name, a name used twice, a lone radio button, a file field without multipart and a select with no option are warnings) and of object-check-lib.mjs (no Flash in an object, embed or param and no object or embed from http:// are errors; any other object or embed is a warning) and of number-check-lib.mjs (width and height of a picture, video or canvas are numbers, colspan, rowspan, span, rows, cols and size are whole numbers, start of an ol and value of an li are whole numbers; a width written as 640px or 100%, a colspan of 0 or above 1000 and a rows, cols or size of 0 are warnings) and of range-check-lib.mjs (the max and value of a progress, the min, max, low, high, optimum and value of a meter and the min, max and step of a number or range field are numbers; a progress max of 0 or below, a value outside its range, a min above its max and a step of 0 or below are warnings) and of map-check-lib.mjs (a usemap points to a real map, a map has its own name, an area has a real shape and coords of the right length, an area with a link has an alt; a map nobody uses, an area outside a map and an old shape name are warnings) and of langtag-check-lib.mjs (an hreflang of a link or a srclang of a track that is not a language code is an error; an empty hreflang and a subtitles track with no srclang are warnings) and of input-rules-lib.mjs (a pattern that is not a regular expression in any browser is an error; a pattern that only new browsers drop, a pattern, accept or multiple on a field that does not read it and a minlength above the maxlength are warnings) and of robots-check-lib.mjs (a word of a robots meta tag that is a typo of a real one, a max-image-preview, max-snippet or max-video-preview with a value no crawler knows, follow with nofollow and a meta name that is a typo of robots are errors; an empty content, an unknown word, a list with spaces and no commas and an old word such as noodp are warnings) and of share-check-lib.mjs (a share tag name that is a typo of a real one, a twitter:card or og:type that is a typo of a real value, an og:image:width or og:image:height that is not a whole number of pixels, an og:locale that is not written like en_US, an article time that is not a real ISO date and a twitter:image that is not a full address are errors; an empty content, a value no platform knows, an og:locale with only a language, an http:// picture, a share tag written twice, an og: tag written with name= and a large image card with no picture are warnings) and of jsonld-check-lib.mjs (a script type that is a typo of application/ld+json, a structured data block that is not valid JSON, an @type that is a typo of a real schema.org type or has the wrong capital letters, and a datePublished or dateModified that is not a real ISO date are errors; an empty block, a node with no @context or @type, an @context that is not https://schema.org, an HTML entity in a text and a dateModified before the datePublished are warnings) and of style-attr-lib.mjs (a style attribute with a declaration that has no colon or no value, a property that is a typo of a real one, a number with no unit in a length, a unit or a keyword that is a typo, a hex color that is not 3, 4, 6 or 8 digits, a bracket or a quote never closed, a pasted rule and two declarations joined with no semicolon are errors; an empty style attribute, expression( and the same property twice with the same value are warnings) and of style-block-lib.mjs (a <style> block with a { never closed, a } with no opening one, a { with no selector, a comment or a quote never closed, and in each rule the same faults as a style attribute are errors; an empty <style> block is a warning) and of handler-check-lib.mjs (an on... attribute that is a typo of a real event, such as onclik, and handler code that is not valid JavaScript are errors; an empty handler and a javascript: label are warnings) and of doctype-check-lib.mjs (a page with no <!doctype html>, a mistyped one, one that does not come first or one with a name other than html is an error; an old identifier, a second doctype and a comment before it are warnings) and of url-attr-check-lib.mjs (a javascript:, file: or data: address in action, formaction, cite, ping, poster or longdesc and a formaction with http:// are errors; a ping with http:// and one of these attributes on a tag that ignores it are warnings) and of noscript-check-lib.mjs (a <noscript> in the head that holds anything but link, style and meta, or text, and a <noscript> that is never closed are errors; an empty <noscript>, a <script> inside a <noscript> and a </noscript> with no opening one are warnings) and of structure-check-lib.mjs (a second <html>, <head> or <body>, a <head> after the <body> starts, a tag or text in the head that a head may not hold (it ends the head early), a canonical link in the body and a <title> only in the body are errors; a second <title> in the body, a <meta> with name, property, http-equiv or charset in the body, content after </body> or </html> and a page with no <head> or no <body> tag are warnings) and of alt-text-lib.mjs (an alt that is only a file name or a camera or screenshot name is an error; an alt that is one empty word such as image or photo, one that starts with "image of", one over 125 characters and one of blanks or marks only are warnings) and of target-check-lib.mjs (a target or formtarget that starts with an underscore and is not _blank, _self, _parent or _top, and one of those words with a space around it, are errors; the plain word blank, self, parent, top or new with no underscore is a warning) and of bool-check-lib.mjs (an on/off attribute such as disabled, checked, open, hidden, autoplay or async written as false, 0, no or off is still on and is an error; written as true, 1, yes or on is a warning) and of ref-check-lib.mjs (the headers of a cell, the list, form and popovertarget of a field or button and the for of an output name an id that is on the page; a headers that is not a th, a list that is not a datalist, a form that is not a form and a popovertarget with no popover attribute are warnings) and of picture-check-lib.mjs (a picture has one img as its last child and every source has a srcset and comes before the img; a source with neither type nor media, a source type that is not an image type and an empty media are warnings) and of svg-check-lib.mjs (no script inside an svg and no svg image or use from http://, an svg with role img has a name; an svg with no name that is not hidden, a hidden svg that has a name, an svg with a size and no viewBox, a foreignObject and a use that points to a missing id are warnings) and of meta-check-lib.mjs (a character set other than UTF-8, a refresh with a delay, an http:// base and a second base are errors; a refresh to an address at once, a base that does nothing, a character set twice and a charset after 1024 bytes are warnings) and of script-check-lib.mjs (no script or style sheet from http://, no script with an empty src; a script src with text of its own, async or defer on an inline classic script, nomodule on a module, a script loaded twice and document.write are warnings) and of integrity-check-lib.mjs (an integrity that is not a real sha256, sha384 or sha512 fingerprint, or one on a file from another website with no crossorigin, is an error; an empty integrity, one on a tag that does not read it, and a library-host script or style sheet with none are warnings) and of media-query-check-lib.mjs (a media attribute of a link, source, style or theme-color meta that a browser cannot read: unclosed or empty brackets, a missing and, a type that is not real, a length with no unit, a bad colour scheme, motion or orientation value, a mistyped feature name; a media type that matches nothing and a min-width larger than the max-width are warnings) and of break-check-lib.mjs (a stray </br> is an error; two or more <br> in a row, a paragraph that holds only a <br>, a <br> at the start or end of a paragraph, next to a block tag or directly inside a list or table, and an end tag of an empty element such as </img> are warnings) and of blank-check-lib.mjs (an empty paragraph, list item, quote or caption, and two or more &nbsp; in a row, are warnings) and of shout-check-lib.mjs (a title or heading in all capital letters and one with !! or ?? marks are warnings) and of doubled-check-lib.mjs (a word repeated twice in a row in the text, such as "the the", is a warning) and of garble-check-lib.mjs (a broken character mark, text saved in one encoding and read in another, and a hidden control character in the text are warnings) and of punct-check-lib.mjs (a space before a comma or full stop, repeated commas or dots, and no space after a comma in the text are warnings) and of bracket-check-lib.mjs (a round or square bracket, a curly double quote or a straight double quote that is opened and never closed, or closed and never opened, in the text is a warning) and of bracket-space-check-lib.mjs (a space just inside a bracket, no space before an opening bracket that follows a word and no space after a closing bracket that is followed by a word in the text are warnings) and of quote-space-check-lib.mjs (a space just inside a curly double quote, no space before an opening one that follows a word and no space after a closing one that is followed by a word in the text of an English page are warnings) and of sentence-space-check-lib.mjs (no space after the full stop, question mark or exclamation mark that ends a sentence, such as "left.Then", in the text is a warning) and of dash-check-lib.mjs (two hyphens where a dash belongs, such as "left--then" or "left -- then", in the text is a warning) and of colon-check-lib.mjs (no space after a colon that is followed at once by a word, such as "Note:Do not", in the text is a warning) and of exclaim-check-lib.mjs (a pile of exclamation or question marks, such as "Wow!!" or "Really???", in the body text is a warning) and of capslock-check-lib.mjs (a word typed with Caps Lock on by mistake, such as "hELLO", in the text is a warning) and of allcaps-check-lib.mjs (a run of 10 or more words in capital letters in the body text is a warning) and of repeat-check-lib.mjs (a paragraph written twice in a row, such as a story pasted two times, is a warning) and of paragraph-check-lib.mjs (no div, list, table, heading, figure or other block tag inside a p; a block tag or a p directly inside an inline tag or a heading is a warning) and of parent-check-lib.mjs (a list item, dt, dd, option, figcaption, legend, summary, source and track sit inside the parent HTML names for them; a list with a direct child that is not an li, a dl with a stray child, a details with no summary and a fieldset with no legend are warnings) and of nest-check-lib.mjs (no link inside a link, no button inside a button, no form inside a form; a button inside a link, a link inside a button and a field inside a link or a button are warnings) and of tag-check-lib.mjs (no tag repeats an attribute and no dropped tag such as marquee or frame is used; an old tag such as center or font and an old attribute such as align or bgcolor are warnings) and of lang-check-lib.mjs (every lang and xml:lang is a real language code and every dir is ltr, rtl or auto; a lang and xml:lang that differ are a warning) and of form-controls-lib.mjs (an input type and a button type are real, a maxlength is a whole number; a button with no type inside a form is a warning) and of css-polish-lib.mjs (print rule, focus ring, reduced motion) and of font-check-lib.mjs (fonts on our own site, font-display swap, few faces) and of form-labels-lib.mjs (every form field has a label) and of link-names-lib.mjs (every link and button has a name) and of heading-order-lib.mjs (no empty heading; headings before the h1 and skipped levels are warnings) and of tap-targets-lib.mjs (a button, link or field drawn under 24px is an error, under 44px a warning) and of contrast-lib.mjs (the colour tokens keep 4.5:1 in every look; a rule with text and background under 3:1 is an error, under 4.5:1 a warning).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findEmoji, codePoints } from './no-emoji-lib.mjs';
import { checkImgTags, ownHostsOf } from './img-check-lib.mjs';
import { checkImgLoading } from './img-priority-lib.mjs';
import { checkThumbRatio, thumbCssProblem } from './img-ratio-lib.mjs';
import { checkPageBasics } from './page-basics-lib.mjs';
import { checkLandmarks } from './landmarks-lib.mjs';
import { checkSideScrollCss, checkSideScrollHtml } from './side-scroll-lib.mjs';
import { checkZoomHtml, checkZoomCss } from './zoom-check-lib.mjs';
import { checkNewTabLinks } from './new-tab-lib.mjs';
import { checkIds } from './ids-lib.mjs';
import { checkIframes } from './iframe-check-lib.mjs';
import { checkTables } from './table-check-lib.mjs';
import { checkMedia } from './media-check-lib.mjs';
import { checkHrefs } from './href-check-lib.mjs';
import { checkAria } from './aria-check-lib.mjs';
import { checkTabindex } from './tabindex-check-lib.mjs';
import { checkTimes } from './time-check-lib.mjs';
import { checkFormControls } from './form-controls-lib.mjs';
import { checkLang } from './lang-check-lib.mjs';
import { checkAttrValues } from './attr-values-lib.mjs';
import { checkRel } from './rel-check-lib.mjs';
import { checkInputHints } from './input-hints-lib.mjs';
import { checkSrcset } from './srcset-check-lib.mjs';
import { checkTags } from './tag-check-lib.mjs';
import { checkNesting } from './nest-check-lib.mjs';
import { checkEntities } from './entity-check-lib.mjs';
import { checkParents } from './parent-check-lib.mjs';
import { checkObjects } from './object-check-lib.mjs';
import { checkSvg } from './svg-check-lib.mjs';
import { checkPicture } from './picture-check-lib.mjs';
import { checkNumbers } from './number-check-lib.mjs';
import { checkRanges } from './range-check-lib.mjs';
import { checkMaps } from './map-check-lib.mjs';
import { checkRefs } from './ref-check-lib.mjs';
import { checkBools } from './bool-check-lib.mjs';
import { checkTargets } from './target-check-lib.mjs';
import { checkLangTags } from './langtag-check-lib.mjs';
import { checkInputRules } from './input-rules-lib.mjs';
import { checkRobots } from './robots-check-lib.mjs';
import { checkShareTags } from './share-check-lib.mjs';
import { checkJsonLd } from './jsonld-check-lib.mjs';
import { checkStyleAttrs } from './style-attr-lib.mjs';
import { checkStyleBlocks } from './style-block-lib.mjs';
import { checkHandlers } from './handler-check-lib.mjs';
import { checkDoctype } from './doctype-check-lib.mjs';
import { checkUrlAttrs } from './url-attr-check-lib.mjs';
import { checkNoscript } from './noscript-check-lib.mjs';
import { checkStructure } from './structure-check-lib.mjs';
import { checkAltText } from './alt-text-lib.mjs';
import { checkMeta } from './meta-check-lib.mjs';
import { checkScripts } from './script-check-lib.mjs';
import { checkIntegrity } from './integrity-check-lib.mjs';
import { checkMediaQueries } from './media-query-check-lib.mjs';
import { checkBreaks } from './break-check-lib.mjs';
import { checkBlanks } from './blank-check-lib.mjs';
import { checkShouting } from './shout-check-lib.mjs';
import { checkDoubledWords } from './doubled-check-lib.mjs';
import { checkGarbledText } from './garble-check-lib.mjs';
import { checkPunctuation } from './punct-check-lib.mjs';
import { checkBrackets } from './bracket-check-lib.mjs';
import { checkBracketSpacing } from './bracket-space-check-lib.mjs';
import { checkQuoteSpacing } from './quote-space-check-lib.mjs';
import { checkSentenceSpacing } from './sentence-space-check-lib.mjs';
import { checkDoubleHyphen } from './dash-check-lib.mjs';
import { checkColonSpacing } from './colon-check-lib.mjs';
import { checkExclaimRuns } from './exclaim-check-lib.mjs';
import { checkCapsLockSlips } from './capslock-check-lib.mjs';
import { checkAllCapsRuns } from './allcaps-check-lib.mjs';
import { checkRepeatedParagraphs } from './repeat-check-lib.mjs';
import { checkParagraphs } from './paragraph-check-lib.mjs';
import { checkFormBehavior } from './form-behavior-check-lib.mjs';
import { checkCssPolish } from './css-polish-lib.mjs';
import { checkFontCss, checkFontLinks } from './font-check-lib.mjs';
import { checkFormLabels } from './form-labels-lib.mjs';
import { checkLinkNames } from './link-names-lib.mjs';
import { checkHeadingOrder } from './heading-order-lib.mjs';
import { controlClassesOf, checkTapTargets } from './tap-targets-lib.mjs';
import { checkContrast } from './contrast-lib.mjs';
import { checkHead, checkDuplicateTitles } from './head-check-lib.mjs';

const root = 'dist';
const errors = [];
const warnings = [];
const pages = new Map(); // url path -> { noindex }
const ownHosts = ownHostsOf(process.env.SITE_URL);
let thumbPages = 0; // pages that hold a picture of class thumb
let hasMedia = false, hasPre = false; // some built page has a picture, video or frame / a pre block (side-scroll-lib.mjs)
let allCss = ''; // the text of every style block of the built pages and of every css file
const controlClasses = new Set(); // the class names that sit on a button, link or field of any built page
const titles = []; // { file, title, noindex } of every built page, for the shared title check

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'pagefind' || name === 'admin') continue; // the dashboard is a separate app, never indexed
      walk(p);
    } else if (name.endsWith('.html')) check(p);
    else if (name.endsWith('.css')) allCss += '\n' + readFileSync(p, 'utf8');
  }
}

function urlPath(file) {
  let u = '/' + file.slice(root.length + 1).replace(/\\/g, '/').replace(/index\.html$/, '');
  return u.replace(/\.html$/, '/');
}

function check(file) {
  const html = readFileSync(file, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errors.push(`${file}: expected exactly one H1, found ${h1}`);
  if (/lorem ipsum|example\.com/i.test(html)) errors.push(`${file}: placeholder text found`);
  const emoji = findEmoji(html);
  if (emoji.length) errors.push(`${file}: emoji found (${codePoints(emoji)}); use an inline SVG icon (PLAN 29.3)`);
  const pics = checkImgTags(html, ownHosts);
  pics.errors.forEach((m) => errors.push(`${file}: ${m}`));
  pics.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const type = (html.match(/data-page-type="([^"]+)"/) || [])[1];
  const load = checkImgLoading(html, type);
  checkThumbRatio(html).forEach((m) => errors.push(`${file}: ${m}`));
  checkFontLinks(html).forEach((m) => errors.push(`${file}: ${m}`));
  const basics = checkPageBasics(html);
  basics.errors.forEach((m) => errors.push(`${file}: ${m}`));
  basics.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const marks = checkLandmarks(html, type);
  marks.errors.forEach((m) => errors.push(`${file}: ${m}`));
  marks.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const side = checkSideScrollHtml(html);
  side.errors.forEach((m) => errors.push(`${file}: ${m}`));
  side.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  if (/<(?:img|picture|video|iframe|embed|object)[\s>]/i.test(html)) hasMedia = true;
  if (/<pre[\s>]/i.test(html)) hasPre = true;
  const zoom = checkZoomHtml(html);
  zoom.errors.forEach((m) => errors.push(`${file}: ${m}`));
  zoom.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const tabs = checkNewTabLinks(html);
  tabs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  tabs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const idc = checkIds(html);
  idc.errors.forEach((m) => errors.push(`${file}: ${m}`));
  idc.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const frames = checkIframes(html, ownHosts);
  frames.errors.forEach((m) => errors.push(`${file}: ${m}`));
  frames.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const tbls = checkTables(html);
  tbls.errors.forEach((m) => errors.push(`${file}: ${m}`));
  tbls.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const media = checkMedia(html);
  media.errors.forEach((m) => errors.push(`${file}: ${m}`));
  media.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const hrefs = checkHrefs(html, ownHosts);
  hrefs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  hrefs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const aria = checkAria(html);
  aria.errors.forEach((m) => errors.push(`${file}: ${m}`));
  aria.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const tabs2 = checkTabindex(html);
  tabs2.errors.forEach((m) => errors.push(`${file}: ${m}`));
  tabs2.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const times = checkTimes(html);
  times.errors.forEach((m) => errors.push(`${file}: ${m}`));
  times.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const attrv = checkAttrValues(html);
  attrv.errors.forEach((m) => errors.push(`${file}: ${m}`));
  attrv.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const rels = checkRel(html);
  rels.errors.forEach((m) => errors.push(`${file}: ${m}`));
  rels.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const hints = checkInputHints(html);
  hints.errors.forEach((m) => errors.push(`${file}: ${m}`));
  hints.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const sets = checkSrcset(html);
  sets.errors.forEach((m) => errors.push(`${file}: ${m}`));
  sets.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const ents = checkEntities(html);
  ents.errors.forEach((m) => errors.push(`${file}: ${m}`));
  ents.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const fbeh = checkFormBehavior(html);
  fbeh.errors.forEach((m) => errors.push(`${file}: ${m}`));
  fbeh.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const obj = checkObjects(html);
  obj.errors.forEach((m) => errors.push(`${file}: ${m}`));
  obj.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const nums = checkNumbers(html);
  nums.errors.forEach((m) => errors.push(`${file}: ${m}`));
  nums.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const rngs = checkRanges(html);
  rngs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  rngs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const maps = checkMaps(html);
  maps.errors.forEach((m) => errors.push(`${file}: ${m}`));
  maps.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const refs = checkRefs(html);
  refs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  refs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const bools = checkBools(html);
  bools.errors.forEach((m) => errors.push(`${file}: ${m}`));
  bools.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const tgts = checkTargets(html);
  tgts.errors.forEach((m) => errors.push(`${file}: ${m}`));
  tgts.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const ltags = checkLangTags(html);
  ltags.errors.forEach((m) => errors.push(`${file}: ${m}`));
  ltags.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const inrules = checkInputRules(html);
  inrules.errors.forEach((m) => errors.push(`${file}: ${m}`));
  inrules.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const robs = checkRobots(html);
  robs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  robs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const shr = checkShareTags(html);
  shr.errors.forEach((m) => errors.push(`${file}: ${m}`));
  shr.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const jld = checkJsonLd(html);
  jld.errors.forEach((m) => errors.push(`${file}: ${m}`));
  jld.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const sty = checkStyleAttrs(html);
  sty.errors.forEach((m) => errors.push(`${file}: ${m}`));
  sty.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const stb = checkStyleBlocks(html);
  stb.errors.forEach((m) => errors.push(`${file}: ${m}`));
  stb.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const hnd = checkHandlers(html);
  hnd.errors.forEach((m) => errors.push(`${file}: ${m}`));
  hnd.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const dtp = checkDoctype(html);
  dtp.errors.forEach((m) => errors.push(`${file}: ${m}`));
  dtp.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const uat = checkUrlAttrs(html);
  uat.errors.forEach((m) => errors.push(`${file}: ${m}`));
  uat.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const nsc = checkNoscript(html);
  nsc.errors.forEach((m) => errors.push(`${file}: ${m}`));
  nsc.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const stc = checkStructure(html);
  stc.errors.forEach((m) => errors.push(`${file}: ${m}`));
  stc.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const alt = checkAltText(html);
  alt.errors.forEach((m) => errors.push(`${file}: ${m}`));
  alt.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const pictr = checkPicture(html);
  pictr.errors.forEach((m) => errors.push(`${file}: ${m}`));
  pictr.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const svgs = checkSvg(html);
  svgs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  svgs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const mta = checkMeta(html);
  mta.errors.forEach((m) => errors.push(`${file}: ${m}`));
  mta.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const scr = checkScripts(html);
  scr.errors.forEach((m) => errors.push(`${file}: ${m}`));
  scr.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const sri = checkIntegrity(html, ownHosts);
  sri.errors.forEach((m) => errors.push(`${file}: ${m}`));
  sri.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const mq = checkMediaQueries(html);
  mq.errors.forEach((m) => errors.push(`${file}: ${m}`));
  mq.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const brk = checkBreaks(html);
  brk.errors.forEach((m) => errors.push(`${file}: ${m}`));
  brk.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const blanks = checkBlanks(html);
  blanks.errors.forEach((m) => errors.push(`${file}: ${m}`));
  blanks.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const shouts = checkShouting(html);
  shouts.errors.forEach((m) => errors.push(`${file}: ${m}`));
  shouts.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const doubled = checkDoubledWords(html);
  doubled.errors.forEach((m) => errors.push(`${file}: ${m}`));
  doubled.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const garbled = checkGarbledText(html);
  garbled.errors.forEach((m) => errors.push(`${file}: ${m}`));
  garbled.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const punct = checkPunctuation(html);
  punct.errors.forEach((m) => errors.push(`${file}: ${m}`));
  punct.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const brackets = checkBrackets(html);
  brackets.errors.forEach((m) => errors.push(`${file}: ${m}`));
  brackets.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const bspace = checkBracketSpacing(html);
  bspace.errors.forEach((m) => errors.push(`${file}: ${m}`));
  bspace.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const qspace = checkQuoteSpacing(html);
  qspace.errors.forEach((m) => errors.push(`${file}: ${m}`));
  qspace.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const sspace = checkSentenceSpacing(html);
  sspace.errors.forEach((m) => errors.push(`${file}: ${m}`));
  sspace.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const dashes = checkDoubleHyphen(html);
  dashes.errors.forEach((m) => errors.push(`${file}: ${m}`));
  dashes.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const colons = checkColonSpacing(html);
  colons.errors.forEach((m) => errors.push(`${file}: ${m}`));
  colons.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const piles = checkExclaimRuns(html);
  piles.errors.forEach((m) => errors.push(`${file}: ${m}`));
  piles.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const caps = checkCapsLockSlips(html);
  caps.errors.forEach((m) => errors.push(`${file}: ${m}`));
  caps.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const capRuns = checkAllCapsRuns(html);
  capRuns.errors.forEach((m) => errors.push(`${file}: ${m}`));
  capRuns.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const repeats = checkRepeatedParagraphs(html);
  repeats.errors.forEach((m) => errors.push(`${file}: ${m}`));
  repeats.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const paras = checkParagraphs(html);
  paras.errors.forEach((m) => errors.push(`${file}: ${m}`));
  paras.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const parents = checkParents(html);
  parents.errors.forEach((m) => errors.push(`${file}: ${m}`));
  parents.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const nests = checkNesting(html);
  nests.errors.forEach((m) => errors.push(`${file}: ${m}`));
  nests.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const tagsc = checkTags(html);
  tagsc.errors.forEach((m) => errors.push(`${file}: ${m}`));
  tagsc.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const langs = checkLang(html);
  langs.errors.forEach((m) => errors.push(`${file}: ${m}`));
  langs.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const controls = checkFormControls(html);
  controls.errors.forEach((m) => errors.push(`${file}: ${m}`));
  controls.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const forms = checkFormLabels(html);
  forms.errors.forEach((m) => errors.push(`${file}: ${m}`));
  forms.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const names = checkLinkNames(html);
  names.errors.forEach((m) => errors.push(`${file}: ${m}`));
  names.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  const head = checkHead(html);
  head.errors.forEach((m) => errors.push(`${file}: ${m}`));
  head.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  titles.push({ file, title: head.title, noindex: head.noindex });
  const heads = checkHeadingOrder(html);
  heads.errors.forEach((m) => errors.push(`${file}: ${m}`));
  heads.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  for (const c of controlClassesOf(html)) controlClasses.add(c);
  if (/<img\b[^>]*\bclass\s*=\s*["'][^"']*\bthumb\b/i.test(html)) thumbPages++;
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) allCss += '\n' + m[1];
  load.errors.forEach((m) => errors.push(`${file}: ${m}`));
  load.warnings.forEach((m) => warnings.push(`${file}: ${m}`));
  if (type !== 'article' && /data-ad-slot|class="ad-slot"|data-ad-loader|adsClient|<script[^>]*adsterra|(?:src|href|data-[a-z-]+)="[^"]*adsterra|pagead2\.googlesyndication/i.test(html))
    errors.push(`${file}: ad code found outside an article page`);
  if (type !== 'article' && /data-beacon|beaconClient/.test(html))
    errors.push(`${file}: analytics beacon found outside an article page`);

  const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
  const noindex = /noindex/i.test(robots);
  pages.set(urlPath(file), { noindex });
  if (!/<link rel="canonical" href="[^"]+"/.test(html)) errors.push(`${file}: missing canonical`);
  if (!noindex && type !== '404' && !/<meta name="description" content="[^"]+"/.test(html) && type !== 'home' && type !== 'category' && type !== 'tag')
    warnings.push(`${file}: no meta description`);

  // JSON-LD must parse (BUGS S8).
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const docs = [];
  for (const b of blocks) {
    try { docs.push(JSON.parse(b)); } catch { errors.push(`${file}: invalid JSON-LD`); }
  }
  if (type === 'article') {
    const a = docs.find((d) => ['NewsArticle', 'Article', 'BlogPosting'].includes(d['@type']));
    if (!a) errors.push(`${file}: no article schema`);
    else for (const f of ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'])
      if (!a[f]) errors.push(`${file}: article schema missing ${f}`);
    if (!docs.some((d) => d['@type'] === 'BreadcrumbList')) errors.push(`${file}: no breadcrumb schema`);
  }
  if (type === 'home' && !docs.some((d) => d['@type'] === 'WebSite')) errors.push(`${file}: home needs WebSite schema`);
}

walk(root);

// POLISH: pictures of class thumb are drawn 16:9 and cropped, never stretched (only when some page has such a picture).
if (thumbPages > 0) { const p = thumbCssProblem(allCss); if (p) errors.push(`dist: ${p}`); }

// POLISH: fonts on our own site with font-display swap, print rule, visible focus ring, reduced motion, tap targets of 24px (error) and 44px (warning), contrast of text colours (only when some page was built).
if (pages.size > 0) {
  for (const r of [checkFontCss(allCss), checkCssPolish(allCss), checkSideScrollCss(allCss, { images: hasMedia, pre: hasPre }), checkZoomCss(allCss), checkTapTargets(allCss, [...controlClasses]), checkContrast(allCss)]) {
    r.errors.forEach((m) => errors.push(`dist: ${m}`));
    r.warnings.forEach((m) => warnings.push(`dist: ${m}`));
  }
}

// Sitemaps must list only pages that exist and are indexable (BUGS S3, S6).
for (const f of existsSync(root) ? readdirSync(root).filter((n) => /^(sitemap-.*|news-sitemap)\.xml$/.test(n) && n !== 'sitemap-index.xml') : []) {
  const xml = readFileSync(join(root, f), 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let path;
    try { path = new URL(m[1].replace(/&amp;/g, '&')).pathname; } catch { errors.push(`${f}: bad URL ${m[1]}`); continue; }
    const pg = pages.get(path);
    if (!pg) errors.push(`${f}: lists ${path} but no such page was built`);
    else if (pg.noindex) errors.push(`${f}: lists noindex page ${path}`);
  }
}

// POLISH: indexable pages with one title (a shared title is a warning).
checkDuplicateTitles(titles).forEach((m) => warnings.push(m));

// v0.2.2: on a real host (Cloudflare Pages sets CF_PAGES, GitHub Actions sets CI) a missing SITE_URL stops the build.
if (!process.env.SITE_URL) {
  const msg = 'SITE_URL is not set: canonicals, sitemaps and robots.txt would use http://localhost:4321. Set SITE_URL on your host.';
  if (process.env.CF_PAGES || process.env.CI) errors.push(msg);
  else warnings.push(msg + ' (warning only on your own computer)');
}
warnings.forEach((w) => console.warn('warn: ' + w));
if (errors.length) {
  console.error('Validation failed:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Validation passed.');
