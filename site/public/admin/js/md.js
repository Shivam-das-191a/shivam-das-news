// Tiny, safe Markdown preview for the editor. Everything is HTML-escaped first, so pasted HTML or scripts never run.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u) => (/^(https?:\/\/|\/|#|mailto:)/i.test(u) ? u : '#');

function inline(s, img) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img alt="${a}" src="${esc(safeUrl(img ? img(u.replace(/&amp;/g, '&')) : u.replace(/&amp;/g, '&')))}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${esc(safeUrl(u.replace(/&amp;/g, '&')))}" rel="noopener">${t}</a>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

export function renderMarkdown(md, img) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { const n = Math.max(2, h[1].length); out.push(`<h${n}>${inline(h[2], img)}</h${n}>`); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '), img)}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const buf = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) buf.push(`<li>${inline(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''), img)}</li>`);
      out.push(`<${ordered ? 'ol' : 'ul'}>${buf.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^(---|\*\*\*)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s+)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '), img)}</p>`);
  }
  return out.join('\n');
}
