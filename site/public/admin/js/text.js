// Text helpers shared by the SEO score and the validator (same rules as src/lib/headings.ts, gate.ts, readtime.ts).
export const wordCount = (t) => t.trim().split(/\s+/).filter(Boolean).length;

export function lintHeadings(markdown) {
  const errors = [];
  const lines = markdown.split(/\r?\n/);
  let fence = false;
  let last = 1;
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    if (fence) return;
    const n = i + 1;
    if (/^=+\s*$/.test(line) && i > 0 && lines[i - 1].trim()) { errors.push(`line ${n}: H1 (underline style) is not allowed in the body`); return; }
    if (/^<h1[\s>]/i.test(line.trim())) { errors.push(`line ${n}: <h1> is not allowed in the body`); return; }
    const m = /^(#{1,6})\s+\S/.exec(line);
    const hm = /^<h([2-6])[\s>]/i.exec(line.trim());
    const h = m ? m[1].length : hm ? Number(hm[1]) : 0;
    if (!h) return;
    if (h === 1) { errors.push(`line ${n}: H1 is not allowed in the body (the title is the H1)`); return; }
    if (h > last + 1) errors.push(`line ${n}: heading jumps from H${last} to H${h}`);
    last = h;
  });
  return errors;
}

const BAIT = /\b(shocking|you won'?t believe|jaw[- ]dropping|mind[- ]blowing|this one trick|what happens next|gone wrong|will blow your mind)\b/i;
export function clickbaitWarning(title) {
  const caps = title.split(/\s+/).filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (caps.length >= 2) return 'title has several ALL CAPS words';
  if (BAIT.test(title)) return 'title uses clickbait wording';
  if ((title.match(/[!?]/g) || []).length >= 2) return 'title has repeated ! or ?';
  return null;
}

/** Plain text of a Markdown body (links keep their text, code and images are dropped). */
export function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/^\s*(?:[-+]|\d+\.)\s+/gm, '');
}
