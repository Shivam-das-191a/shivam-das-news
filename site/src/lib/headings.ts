/**
 * Phase 2: heading linter (PLAN 5.2, BUGS S1). The title is the only H1,
 * body headings start at H2 and never skip a level.
 */
export function lintHeadings(markdown: string): string[] {
  const errors: string[] = [];
  const lines = markdown.split(/\r?\n/);
  let fence = false;
  let last = 1; // the page title is H1
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
