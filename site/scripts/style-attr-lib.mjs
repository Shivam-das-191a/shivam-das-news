// Part 8bc (POLISH, Inline styles): the style="..." attributes of a built page are written the way a browser can read them.
// A style written by hand in a post or a pasted snippet (PLAN 37) is thrown away by the browser, with no message, when one small thing is wrong:
// a missing colon, a property written backgroud, a size with no unit (width:300), a color with five digits (#12345), a bracket never closed.
// The dashboard preview does not show the fault, and the reader just sees a page that looks wrong. Pure function, no files, no network.
//   checkStyleAttrs(html): { errors, warnings }
//   errors:   a declaration with no colon; a name that cannot be a property; a property that is a typo of a real one (backgroud, colour, widht);
//             a declaration with no value; a bracket ( that is never closed, a ) with no opening one, a quote that is never closed;
//             a whole rule pasted into the attribute (p{color:red}); two declarations joined with no semicolon (color:red background:blue);
//             a length property (width, margin, padding, font-size, top ...) with a number that has no unit (width:300, margin:10 px) or a unit that is a typo (10xp);
//             a keyword that is a typo of a real one for display, position, float, overflow, text-align and a few more (position:abosolute);
//             a hex color that is not 3, 4, 6 or 8 digits; a ! that is not !important
//   warnings: an empty style attribute; expression(, javascript:, behavior: or -moz-binding in a style (old tricks that modern browsers ignore);
//             the same property written twice with the same value
// Read on: every start tag with a style="..." attribute (the first one when a tag has two); the HTML characters &quot; &amp; &#39; in the value are decoded first.
// Left out on purpose, so there is no false alarm: custom properties (--name) and their values; vendor properties (-webkit-line-clamp); a property that is not close to any
//   listed one (a new CSS property is fine); a value that is not close to a listed keyword; var(), calc(), env() and other functions; line-height with a plain number
//   (that is valid); the same property written twice with different values (a fallback such as display:-webkit-box then display:flex is normal);
//   a value that holds a template expression ({value}); text inside comments, script, style and <template>; the case of names and values.
// Why: nothing else reads style attributes for faults; side-scroll-lib.mjs reads only the width inside them.
const SKIP = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const PROPS = new Set(`align-content align-items align-self all animation animation-composition animation-delay animation-direction animation-duration animation-fill-mode
animation-iteration-count animation-name animation-play-state animation-range animation-timeline animation-timing-function appearance aspect-ratio backdrop-filter
backface-visibility background background-attachment background-blend-mode background-clip background-color background-image background-origin background-position
background-position-x background-position-y background-repeat background-size block-size border border-block border-block-color border-block-end border-block-end-color
border-block-end-style border-block-end-width border-block-start border-block-start-color border-block-start-style border-block-start-width border-block-style
border-block-width border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius border-bottom-style border-bottom-width border-collapse
border-color border-end-end-radius border-end-start-radius border-image border-image-outset border-image-repeat border-image-slice border-image-source
border-image-width border-inline border-inline-color border-inline-end border-inline-end-color border-inline-end-style border-inline-end-width border-inline-start
border-inline-start-color border-inline-start-style border-inline-start-width border-inline-style border-inline-width border-left border-left-color border-left-style
border-left-width border-radius border-right border-right-color border-right-style border-right-width border-spacing border-start-end-radius border-start-start-radius
border-style border-top border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width bottom box-decoration-break
box-shadow box-sizing break-after break-before break-inside caption-side caret-color clear clip clip-path clip-rule color color-interpolation color-interpolation-filters
color-scheme column-count column-fill column-gap column-rule column-rule-color column-rule-style column-rule-width column-span column-width columns contain
contain-intrinsic-size container container-name container-type content content-visibility counter-increment counter-reset counter-set cursor cx cy d direction display
dominant-baseline empty-cells fill fill-opacity fill-rule filter flex flex-basis flex-direction flex-flow flex-grow flex-shrink flex-wrap float flood-color flood-opacity
font font-family font-feature-settings font-kerning font-language-override font-optical-sizing font-size font-size-adjust font-smooth font-stretch font-style font-synthesis
font-variant font-variant-alternates font-variant-caps font-variant-east-asian font-variant-ligatures font-variant-numeric font-variant-position
font-variation-settings font-weight forced-color-adjust gap grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-gap
grid-column-start grid-gap grid-row grid-row-end grid-row-gap grid-row-start grid-template grid-template-areas grid-template-columns grid-template-rows
hanging-punctuation height hyphenate-character hyphens image-orientation image-rendering inline-size inset inset-block inset-block-end inset-block-start inset-inline
inset-inline-end inset-inline-start isolation justify-content justify-items justify-self left letter-spacing lighting-color line-break line-height list-style
list-style-image list-style-position list-style-type margin margin-block margin-block-end margin-block-start margin-bottom margin-inline margin-inline-end
margin-inline-start margin-left margin-right margin-top marker marker-end marker-mid marker-start mask mask-clip mask-composite mask-image mask-mode mask-origin
mask-position mask-repeat mask-size mask-type max-block-size max-height max-inline-size max-width min-block-size min-height min-inline-size min-width mix-blend-mode
object-fit object-position offset offset-anchor offset-distance offset-path offset-rotate opacity order orphans outline outline-color outline-offset outline-style
outline-width overflow overflow-anchor overflow-block overflow-clip-margin overflow-inline overflow-wrap overflow-x overflow-y overscroll-behavior
overscroll-behavior-block overscroll-behavior-inline overscroll-behavior-x overscroll-behavior-y padding padding-block padding-block-end padding-block-start
padding-bottom padding-inline padding-inline-end padding-inline-start padding-left padding-right padding-top page page-break-after page-break-before page-break-inside
paint-order perspective perspective-origin place-content place-items place-self pointer-events position print-color-adjust quotes r resize right rotate row-gap
ruby-align ruby-position rx ry scale scroll-behavior scroll-margin scroll-margin-block scroll-margin-bottom scroll-margin-inline scroll-margin-left scroll-margin-right
scroll-margin-top scroll-padding scroll-padding-block scroll-padding-bottom scroll-padding-inline scroll-padding-left scroll-padding-right scroll-padding-top
scroll-snap-align scroll-snap-stop scroll-snap-type scrollbar-color scrollbar-gutter scrollbar-width shape-image-threshold shape-margin shape-outside shape-rendering
stop-color stop-opacity stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width tab-size table-layout
text-align text-align-last text-anchor text-combine-upright text-decoration text-decoration-color text-decoration-line text-decoration-skip-ink text-decoration-style
text-decoration-thickness text-emphasis text-emphasis-color text-emphasis-position text-emphasis-style text-indent text-justify text-orientation text-overflow
text-rendering text-shadow text-size-adjust text-transform text-underline-offset text-underline-position text-wrap text-wrap-mode text-wrap-style top touch-action
transform transform-box transform-origin transform-style transition transition-behavior transition-delay transition-duration transition-property
transition-timing-function translate unicode-bidi user-select vector-effect vertical-align view-transition-name visibility white-space white-space-collapse widows width
will-change word-break word-spacing word-wrap writing-mode x y z-index zoom accent-color interpolate-size field-sizing initial-letter text-box text-box-trim
text-box-edge anchor-name position-anchor position-area position-try position-try-fallbacks position-visibility scroll-timeline view-timeline timeline-scope
math-style math-depth line-clamp speak speak-as azimuth`.split(/\s+/));

// Properties whose value is a length (a number with a unit, 0, a percent, auto, a keyword or a function). A plain number other than 0 is ignored by the browser.
const LENGTHS = new Set(`width height min-width max-width min-height max-height block-size inline-size margin margin-top margin-right margin-bottom margin-left
margin-block margin-inline padding padding-top padding-right padding-bottom padding-left padding-block padding-inline top right bottom left inset font-size gap row-gap
column-gap border-width border-top-width border-right-width border-bottom-width border-left-width border-radius outline-width outline-offset letter-spacing word-spacing
text-indent border-spacing column-width flex-basis`.split(/\s+/));

const UNITS = new Set(`px em rem ex ch vw vh vmin vmax vb vi cm mm in pt pc q lh rlh cap rcap ic ric rex rch svw svh svmin svmax lvw lvh lvmin lvmax dvw dvh dvmin dvmax
cqw cqh cqi cqb cqmin cqmax fr deg rad grad turn s ms hz khz dpi dpcm dppx x`.split(/\s+/));

// The real length units: only these are the target of a typo (10xp), so a time or an angle unit is never offered for a length.
const LENGTH_UNITS = new Set(`px em rem ex ch vw vh vmin vmax vb vi cm mm in pt pc q lh rlh cap rcap ic ric rex rch svw svh svmin svmax lvw lvh lvmin lvmax dvw dvh dvmin dvmax
cqw cqh cqi cqb cqmin cqmax`.split(/\s+/));

const GLOBAL = ['inherit', 'initial', 'unset', 'revert', 'revert-layer'];
const KEYWORDS = {
  display: 'none block inline inline-block flex inline-flex grid inline-grid contents table table-row table-cell table-row-group table-header-group table-footer-group table-column table-column-group table-caption inline-table list-item flow-root flow ruby run-in math',
  position: 'static relative absolute fixed sticky',
  float: 'none left right inline-start inline-end',
  clear: 'none left right both inline-start inline-end',
  visibility: 'visible hidden collapse',
  overflow: 'visible hidden clip scroll auto',
  'overflow-x': 'visible hidden clip scroll auto',
  'overflow-y': 'visible hidden clip scroll auto',
  'text-align': 'left right center justify start end match-parent justify-all',
  'text-transform': 'none capitalize uppercase lowercase full-width full-size-kana',
  'white-space': 'normal nowrap pre pre-wrap pre-line break-spaces',
  'font-style': 'normal italic oblique',
  'box-sizing': 'content-box border-box',
  'object-fit': 'fill contain cover none scale-down',
};
for (const k of Object.keys(KEYWORDS)) KEYWORDS[k] = new Set([...KEYWORDS[k].split(' '), ...GLOBAL]);

const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

/** Edit distance where swapping two neighbouring letters counts as one change (widht is a typo of width). */
function distance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The listed word this word is one change away from, or '' when it is not close to any (or when it is itself listed). */
function typoOf(word, list, minLength) {
  if (word.length < minLength || word.length > 60) return '';
  for (const w of list) {
    if (Math.abs(w.length - word.length) > 1) continue;
    if (distance(word, w) === 1) return w;
  }
  return '';
}

const decode = (v) => v.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&apos;|&#39;|&#x27;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');

/** The first style attribute of a tag, as text, or null. */
function styleOf(attrText) {
  for (const m of attrText.matchAll(ATTR)) {
    if (m[1].toLowerCase() === 'style') return m[2] ?? m[3] ?? m[4] ?? '';
  }
  return null;
}

/** Cuts a style into declarations at the semicolons that are outside brackets and quotes. */
function split(style) {
  const parts = [];
  let cur = '', depth = 0, quote = '', stray = false;
  for (let i = 0; i < style.length; i++) {
    const c = style[i];
    if (quote) {
      cur += c;
      if (c === '\\') cur += style[++i] ?? '';
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { if (depth === 0) stray = true; else depth--; }
    if (c === ';' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return { parts, openBracket: depth > 0, openQuote: quote !== '', stray };
}

/** The value with quoted texts and the inside of every bracket emptied, so only the plain words are left. */
function plain(value) {
  let v = value.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  let before;
  do { before = v; v = v.replace(/\([^()]*\)/g, '()'); } while (v !== before);
  return v;
}

/** Checks the declarations (already cut at the semicolons) of one style attribute or one CSS rule. err(msg) and warn(msg) collect the plain sentences. */
export function checkDeclarations(parts, err, warn) {
  const seen = new Map();
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    const i = t.indexOf(':');
    if (i < 0) { err(`"${short(t)}" has no colon; write property: value`); continue; }
    const name = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if (/^--/.test(name)) { if (/\s/.test(name)) err(`"${short(name)}" is not a property name`); continue; }
    if (!/^-?[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) { err(`"${short(name)}" is not a property name`); continue; }
    const low = name.toLowerCase();
    if (low.startsWith('-')) continue; // vendor property
    if (!PROPS.has(low)) {
      const near = typoOf(low, PROPS, 5);
      if (near) err(`${short(name)} is not a CSS property; it looks like a typo of ${near}, so the browser ignores it`);
      continue;
    }
    const bang = /!\s*([a-zA-Z]*)\s*$/.exec(value);
    if (bang) {
      if (bang[1].toLowerCase() !== 'important') err(`${low}: "!${bang[1]}" is not valid; write !important`);
      value = value.slice(0, bang.index).trim();
    }
    if (!value) { err(`${low} has no value`); continue; }
    const key = value.toLowerCase().replace(/\s+/g, ' ');
    const list = seen.get(low) ?? new Set();
    if (list.has(key)) warn(`${low} is written twice with the same value (${short(value)})`);
    list.add(key);
    seen.set(low, list);
    const p = plain(value);
    if (/\S\s+(?!progid)[a-zA-Z][a-zA-Z-]*\s*:/.test(p)) err(`${low}: ${short(value)} looks like two declarations joined with no semicolon between them`);
    const tokens = p.split(/[\s,/]+/).filter(Boolean);
    for (const token of tokens) {
      if (token.startsWith('#') && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(token))
        err(`${low}: ${short(token)} is not a color; a hex color has 3, 4, 6 or 8 digits`);
    }
    if (LENGTHS.has(low)) {
      for (const token of tokens) {
        if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(token)) {
          if (Number(token) !== 0) err(`${low}: ${short(token)} is a number with no unit, so the browser ignores it; write ${short(token)}px`);
        } else {
          const u = /^[+-]?(?:\d+\.?\d*|\.\d+)([a-zA-Z]+)$/.exec(token);
          if (u && !UNITS.has(u[1].toLowerCase())) {
            const near = typoOf(u[1].toLowerCase(), LENGTH_UNITS, 2);
            if (near) err(`${low}: the unit of ${short(token)} looks like a typo of ${near}, so the browser ignores it`);
          }
        }
      }
    }
    const kw = KEYWORDS[low];
    if (kw) {
      for (const token of tokens) {
        const t2 = token.toLowerCase();
        if (!/^[a-z-]+$/.test(t2) || kw.has(t2)) continue;
        const near = typoOf(t2, kw, 4);
        if (near) err(`${low}: ${short(token)} looks like a typo of ${near}, so the browser ignores it`);
      }
    }
  }
}

export function checkStyleAttrs(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const raw = styleOf(m[2]);
    if (raw === null) continue;
    const where = `a <${tag}> style attribute`;
    const err = (msg) => errors.push(`${where}: ${msg}`);
    const warn = (msg) => warnings.push(`${where}: ${msg}`);
    const text = decode(raw).replace(/\/\*[\s\S]*?\*\//g, '');
    if (!text.trim()) { warn('it is empty and does nothing; remove it'); continue; }
    if (/^\s*\{/.test(text)) continue; // a template expression, the real value is not there yet
    if (/expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding/i.test(text))
      warn('it holds expression(, javascript:, behavior: or -moz-binding; modern browsers ignore these, so remove them');
    if (/^[^:;{}]*\{[^{}]*:[^{}]*\}/.test(text)) {
      err(`it holds a whole rule (${short(text.trim())}); an attribute takes only property: value pairs, with no selector and no braces`);
      continue;
    }
    if (text.includes('{')) continue; // a template expression inside the value
    const cut = split(text);
    if (cut.openBracket || cut.openQuote || cut.stray) {
      if (cut.openBracket) err('a bracket ( is never closed, so the browser drops this declaration and the ones after it');
      if (cut.stray) err('a closing bracket ) has no opening one');
      if (cut.openQuote) err('a quote is never closed, so the browser drops this declaration and the ones after it');
      continue;
    }
    checkDeclarations(cut.parts, err, warn);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
