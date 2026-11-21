// v0.11.0: HTML to Markdown for imported posts (PLAN 11, LOGICS 15, BUGS I5 and S1). Pure; DOMParser comes from the browser.
// Safe by design: scripts, styles, forms, inline styles and event handlers are dropped, only http(s), mailto, # and / links survive,
// body headings start at H2 and never skip a level (the title is the only H1).
const DROP = new Set(['script', 'style', 'noscript', 'form', 'input', 'button', 'select', 'textarea', 'object', 'embed', 'link', 'meta', 'svg', 'canvas', 'template', 'head']);
const UNWRAP = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'center', 'figure', 'dl', 'dd', 'dt', 'details', 'summary', 'nav', 'body', 'html', 'tbody', 'thead', 'tfoot']);
const INLINE = new Set(['a', 'b', 'strong', 'i', 'em', 'span', 'u', 'font', 'small', 'sup', 'sub', 'mark', 'abbr', 'time', 's', 'del', 'ins', 'cite', 'q', 'code', 'kbd', 'samp', 'big', 'tt', 'img', 'br', 'iframe', 'label', 'wbr']);

const clean = (s) => s.replace(/[\u00a0\s]+/g, ' ');
const escText = (s) => clean(s).replace(/([\\`*_[\]<>])/g, '\\$1');
const encUrl = (u) => u.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
const safeHref = (h) => {
  const v = String(h || '').trim();
  if (/^\/\//.test(v)) return 'https:' + v;
  return /^(https?:|mailto:|\/|#)/i.test(v) ? v : '';
};
const protect = (text) => text
  .replace(/^(\s*)([#>+-])(\s)/gm, '$1\\$2$3')
  .replace(/^(\s*)(\d+)([.)])(\s)/gm, '$1$2\\$3$4')
  .replace(/^(\s*)([-=*_]{3,}\s*)$/gm, '$1\\$2');

function inline(nodes, st) {
  let out = '';
  for (const n of nodes) {
    if (n.nodeType === 3) { out += escText(n.nodeValue); continue; }
    if (n.nodeType !== 1) continue;
    const t = n.localName;
    if (DROP.has(t)) { st.dropped++; continue; }
    const kids = Array.from(n.childNodes);
    if (t === 'br') { out += '  \n'; continue; }
    if (t === 'img') { out += image(n, st); continue; }
    if (t === 'iframe') {
      const src = safeHref(n.getAttribute('src'));
      if (src && !src.startsWith('#') && !src.startsWith('/')) { st.embeds++; out += `[Embedded content](${encUrl(src)})`; } else st.dropped++;
      continue;
    }
    if (t === 'code') { const x = n.textContent; out += x.trim() ? (x.includes('`') ? `\`\` ${x} \`\`` : `\`${x}\``) : ''; continue; }
    const inner = inline(kids, st);
    if (t === 'b' || t === 'strong') out += wrap(inner, '**');
    else if (t === 'i' || t === 'em' || t === 'cite') out += wrap(inner, '*');
    else if (t === 'a') out += link(n, inner, kids, st);
    else out += inner; // span, u, font, small, sup, sub, mark ... keep the text, drop the tag and its style
  }
  return out;
}

function wrap(inner, mark) {
  const core = inner.trim();
  if (!core) return inner;
  const lead = inner.slice(0, inner.length - inner.trimStart().length);
  const tail = inner.slice(inner.trimEnd().length);
  return `${lead}${mark}${core}${mark}${tail}`;
}

function image(n, st) {
  let src = (n.getAttribute('src') || n.getAttribute('data-src') || '').trim();
  if (src.startsWith('//')) src = 'https:' + src;
  if (!src || /^data:/i.test(src)) { st.dropped++; return ''; }
  if (!/^(https?:\/\/|\/)/i.test(src)) { st.dropped++; return ''; }
  const alt = clean(n.getAttribute('alt') || '').trim();
  if (!alt) st.noAlt++;
  st.images.push({ src, alt });
  return `![${alt.replace(/([\[\]\\])/g, '\\$1')}](${encUrl(src)})`;
}

function link(n, inner, kids, st) {
  const href = safeHref(n.getAttribute('href'));
  const real = kids.filter((k) => !(k.nodeType === 3 && !k.nodeValue.trim()));
  // Blogger wraps a picture in a link to the big picture: keep only the picture.
  if (real.length === 1 && real[0].localName === 'img') return inner;
  const text = inner.trim();
  if (!text) return '';
  if (!href) return inner;
  return `[${text.replace(/\n/g, ' ')}](${encUrl(href)})`;
}

function paragraph(nodes, st) {
  let text = inline(nodes, st);
  text = text.replace(/(  \n\s*){2,}/g, '\n\n').replace(/\n +/g, '\n').replace(/(  \n|\s)+$/g, '').replace(/^\s+/, '');
  if (!text.trim()) return '';
  return protect(text);
}

function heading(n, st) {
  const level = Number(n.localName[1]);
  const text = inline(Array.from(n.childNodes), st).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const fixed = Math.min(Math.max(level, 2), st.prev + 1);
  if (fixed !== level) st.adjusted = true;
  st.prev = fixed;
  return `${'#'.repeat(fixed)} ${text}`;
}

const indent = (text, pad) => text.split('\n').map((l, i) => (i ? (l ? pad + l : l) : l)).join('\n');

function list(n, st) {
  const ordered = n.localName === 'ol';
  const items = Array.from(n.children).filter((c) => c.localName === 'li');
  const lines = items.map((li, i) => {
    const marker = ordered ? `${i + 1}. ` : '- ';
    const [head = '', ...rest] = blocks(li, st);
    let text = head;
    for (const r of rest) text += '\n' + r;
    return marker + indent(text, ' '.repeat(marker.length));
  });
  return lines.join('\n');
}

function table(n, st) {
  const rows = Array.from(n.querySelectorAll('tr')).map((tr) => Array.from(tr.children).filter((c) => c.localName === 'td' || c.localName === 'th').map((c) => inline(Array.from(c.childNodes), st).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()));
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (!rows.length || !width) return '';
  const fmt = (r) => '| ' + Array.from({ length: width }, (_, i) => r[i] || ' ').join(' | ') + ' |';
  return [fmt(rows[0]), '| ' + Array.from({ length: width }, () => '---').join(' | ') + ' |', ...rows.slice(1).map(fmt)].join('\n');
}

function fence(text) {
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map((s) => s.length));
  const f = '`'.repeat(longest + 1);
  return `${f}\n${text.replace(/\n+$/, '')}\n${f}`;
}

function blocks(parent, st) {
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) { const p = paragraph(buf, st); if (p) out.push(p); buf = []; } };
  for (const n of Array.from(parent.childNodes)) {
    if (n.nodeType === 3) { buf.push(n); continue; }
    if (n.nodeType !== 1) continue;
    const t = n.localName;
    if (DROP.has(t)) { st.dropped++; continue; }
    if (INLINE.has(t) && !hasBlock(n)) { buf.push(n); continue; }
    flush();
    if (/^h[1-6]$/.test(t)) { const h = heading(n, st); if (h) out.push(h); }
    else if (t === 'p') { const p = paragraph(Array.from(n.childNodes), st); if (p) out.push(p); }
    else if (t === 'ul' || t === 'ol') { const l = list(n, st); if (l) out.push(l); }
    else if (t === 'li') out.push(...blocks(n, st));
    else if (t === 'blockquote') { const q = blocks(n, st).join('\n\n'); if (q) out.push(q.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n')); }
    else if (t === 'pre') { const x = n.textContent; if (x.trim()) out.push(fence(x)); }
    else if (t === 'hr') out.push('---');
    else if (t === 'table') { const x = table(n, st); if (x) out.push(x); }
    else if (t === 'figcaption') { const p = paragraph(Array.from(n.childNodes), st); if (p) out.push(p); }
    else out.push(...blocks(n, st)); // div, section, figure and unknown tags: keep the content, drop the wrapper
  }
  flush();
  return out;
}

const hasBlock = (n) => Array.from(n.querySelectorAll('*')).some((c) => !INLINE.has(c.localName) && !DROP.has(c.localName));

/** { markdown, images: [{ src, alt }], warnings: [string] } */
export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  const st = { images: [], dropped: 0, embeds: 0, noAlt: 0, adjusted: false, prev: 1 };
  const md = blocks(doc.body, st).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  const warnings = [];
  if (st.dropped) warnings.push(`${st.dropped} unsafe or unusable element(s) removed (scripts, forms, styles, broken images).`);
  if (st.embeds) warnings.push(`${st.embeds} embed(s) became plain links (embed blocks are not built yet).`);
  if (st.noAlt) warnings.push(`${st.noAlt} image(s) have no alt text.`);
  if (st.adjusted) warnings.push('Heading levels were adjusted: the body starts at H2 and never skips a level.');
  return { markdown: md ? md + '\n' : '', images: st.images, warnings };
}
