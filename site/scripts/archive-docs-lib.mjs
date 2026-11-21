// Phase 3k Part 6 (LOGICS 31.10): moves old "Open Items After vX" blocks and old changelog entries to docs/archive/ without losing a word.
// Pure functions. scripts/archive-docs.mjs reads and writes the files.

const wc = (t) => (String(t ?? '').match(/\S+/g) || []).length;
export const wordsOf = wc;

/** Splits a document at its "## " headings (code fences are skipped). head + the sections joined give back the exact original. */
export function splitSections(text) {
  const lines = String(text).split(/(?<=\n)/);
  const head = [];
  const sections = [];
  let fence = false, cur = null;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^## /.test(line)) { cur = { heading: line.replace(/\r?\n$/, ''), text: line }; sections.push(cur); continue; }
    if (cur) cur.text += line; else head.push(line);
  }
  return { head: head.join(''), sections };
}

/** "Open Items After v0.101.6" gives "v0.101.6"; "0.101.6 (2026-11-16): ..." gives "v0.101.6"; otherwise ''. */
export function versionOf(heading) {
  const a = /Open Items After (v\d+(?:\.\d+)+)/.exec(heading);
  if (a) return a[1];
  const b = /^##\s+(\d+(?:\.\d+)+)(?:\s|$)/.exec(heading);
  return b ? 'v' + b[1] : '';
}

export const isOpenItems = (s) => /^## Open Items After v\d/.test(s.heading);
export const isChangelogEntry = (s) => /^## \d+\.\d+/.test(s.heading);

/**
 * Chooses what moves. The first `keep` movable sections (the newest, they are at the top) stay; the rest move.
 * Returns { kept: [sections in original order], moved: [sections in original order], range: 'v0.64.0-v0.101.5' | '' }.
 */
export function plan(text, isMovable, keep) {
  const { head, sections } = splitSections(text);
  let seen = 0;
  const kept = [], moved = [];
  for (const s of sections) {
    if (isMovable(s)) { seen++; (seen <= keep ? kept : moved).push(s); } else kept.push(s);
  }
  let range = '';
  if (moved.length) {
    const first = versionOf(moved[moved.length - 1].heading), last = versionOf(moved[0].heading);
    range = first && last ? (first === last ? first : `${first}-${last}`) : '';
  }
  return { head, kept, moved, range };
}

/** The new main text: head, a pointer line after the first line, then the kept sections. */
export function rebuildMain(p, archivePath) {
  if (!p.moved.length) return p.head + p.kept.map((s) => s.text).join('');
  const pointer = `Older text is in \`${archivePath}\` (moved there without change).\n`;
  const nl = p.head.indexOf('\n');
  const head = nl === -1 ? p.head + '\n\n' + pointer : p.head.slice(0, nl + 1) + '\n' + pointer + p.head.slice(nl + 1);
  return head + p.kept.map((s) => s.text).join('');
}

/** The archive file: a title, a note, then the moved sections exactly as they were. */
export function archiveText(name, p) {
  return `# Archive of ${name} (${p.range || 'older text'})\n\nMoved here from \`${name}\` without change. Newest first, as in the original.\n\n` + p.moved.map((s) => s.text).join('');
}

/** The archive path for a document, like docs/archive/CHANGELOG-v0.1.0-v0.50.0.md. */
export const archivePath = (name, range) => `docs/archive/${name.replace(/\.md$/, '')}-${range || 'old'}.md`;

/**
 * Proves nothing was lost: every moved section is inside the archive, every kept section is inside the new main,
 * and the words add up (new main minus its pointer line, plus the moved text, equals the original).
 */
export function verifyLossless(original, p, newMain, archive) {
  const bad = [];
  for (const s of p.moved) if (!archive.includes(s.text)) bad.push(`a moved section is missing in the archive: ${s.heading}`);
  for (const s of p.kept) if (!newMain.includes(s.text)) bad.push(`a kept section is missing in the new file: ${s.heading}`);
  if (p.moved.length) {
    const pointerWords = wc(newMain) - wc(p.head) - p.kept.reduce((n, s) => n + wc(s.text), 0);
    const total = wc(newMain) - pointerWords + p.moved.reduce((n, s) => n + wc(s.text), 0);
    if (total !== wc(original)) bad.push(`the words do not add up: ${total} against ${wc(original)}`);
  }
  return bad;
}
