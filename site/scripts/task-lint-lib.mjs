// LOGICS 31 (Phase 3k Part 2): the rules for task cards in tasks/open/ and tasks/done/.
// Pure functions, no file access. scripts/task-lint.mjs reads the files and calls these.

export const OWNERS = ['ai', 'human', 'either'];
export const RISKS = ['green', 'yellow', 'red'];
export const STATUSES = ['idea', 'ready', 'in-progress', 'review', 'verify', 'done', 'blocked'];
export const SECTIONS = ['Goal', 'Why it matters', 'Steps', 'Done when', 'Evidence', 'If it goes wrong', 'Stop and ask the owner if', 'Log'];
// approved-by, claimed-by and blocked-by are optional keys (empty or missing means not set).
const KEYS = ['id', 'title', 'owner', 'risk', 'status', 'time', 'needs', 'paths', 'created'];
const RANK = { green: 0, yellow: 1, red: 2 };

/** Splits a card into its front matter (an object) and its body text. Returns { fm, body, error }. */
export function parseCard(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(String(text ?? ''));
  if (!m) return { fm: {}, body: String(text ?? ''), error: 'no front matter between --- lines' };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (!k) continue;
    let v = k[2].replace(/\s+#.*$/, '').trim();
    if (v.startsWith('[')) {
      v = v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    fm[k[1]] = v;
  }
  return { fm, body: m[2] };
}

/** The text of each "## Heading" section, in order: [{ name, text }]. */
export function sectionsOf(body) {
  const out = [];
  let cur = null;
  for (const line of String(body).split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { cur = { name: h[1], text: '' }; out.push(cur); } else if (cur) cur.text += line + '\n';
  }
  return out.map((s) => ({ name: s.name, text: s.text.trim() }));
}

const under = (p, dir) => p === dir.replace(/\/$/, '') || p.startsWith(dir.endsWith('/') ? dir : dir + '/');
const GREEN_FILES = ['site/config/redirects.json', 'site/config/categories.json'];

/** The risk a list of paths needs (LOGICS 31.3). */
export function riskOfPaths(paths) {
  let r = 'green';
  for (const raw of paths || []) {
    const p = String(raw).replace(/^\.?\//, '');
    let x;
    if (['workers', '.github', 'site/public/admin'].some((d) => under(p, d)) || p === 'site/package.json' || p === 'site/package-lock.json') x = 'red';
    else if (['site/content', 'site/public/media'].some((d) => under(p, d)) || GREEN_FILES.includes(p)) x = 'green';
    else x = 'yellow'; // site/src, tests, scripts, other config, root .md files and anything unknown
    if (RANK[x] > RANK[r]) r = x;
  }
  return r;
}

const SECRETS = [
  /ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /\bsdn_[A-Za-z0-9]{16,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{40,}\b/,
];
/** True when the text holds something that looks like a secret. */
export const hasSecret = (text) => SECRETS.some((re) => re.test(String(text ?? '')));

/** A placeholder in brackets, or only "done" or "ok", is not evidence. */
export function evidenceOk(text) {
  const t = String(text ?? '').trim();
  if (!t || /^\(.*\)$/s.test(t)) return false;
  if (/^(done|ok|okay|finished|yes)\.?$/i.test(t)) return false;
  return t.length >= 30;
}

const overlap = (a, b) => { const x = a.replace(/\/$/, ''), y = b.replace(/\/$/, ''); return x === y || under(x, y) || under(y, x); };

/**
 * Checks one card. `card` = { file, folder: 'open' | 'done', text }. Returns a list of plain sentences (empty = fine).
 */
export function lintCard({ file, folder, text }) {
  const bad = [];
  const { fm, body, error } = parseCard(text);
  if (error) return [`${file}: ${error}`];
  const say = (s) => bad.push(`${file}: ${s}`);
  const name = file.replace(/^.*\//, '').replace(/\.md$/, '');

  for (const k of KEYS) if (!(k in fm)) say(`missing key "${k}"`);
  if (fm.id !== name) say(`id "${fm.id}" must equal the file name "${name}"`);
  if (!/^T-\d{4}$/.test(name)) say('file name must look like T-0000.md');
  if (!fm.title || fm.title.length > 100) say('title must be 1 to 100 characters');
  if (!OWNERS.includes(fm.owner)) say(`owner must be one of ${OWNERS.join(', ')}`);
  if (!RISKS.includes(fm.risk)) say(`risk must be one of ${RISKS.join(', ')}`);
  if (!STATUSES.includes(fm.status)) say(`status must be one of ${STATUSES.join(', ')}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.created || '')) say('created must be YYYY-MM-DD');
  if (!Array.isArray(fm.needs)) say('needs must be a list, for example [] or [T-0001, decision-43]');
  else for (const n of fm.needs) if (!/^(T-\d{4}|decision-\d+)$/.test(n)) say(`needs entry "${n}" must be T-0000 or decision-N`);
  if (!Array.isArray(fm.paths)) say('paths must be a list');

  if (folder === 'open' && fm.status === 'done') say('a card in tasks/open/ cannot have status done (move it to tasks/done/)');
  if (folder === 'done' && fm.status !== 'done') say('a card in tasks/done/ must have status done');

  if (RISKS.includes(fm.risk) && Array.isArray(fm.paths)) {
    const need = riskOfPaths(fm.paths);
    if (RANK[fm.risk] < RANK[need]) say(`risk is ${fm.risk} but its paths need ${need}`);
  }

  const secs = sectionsOf(body);
  const names = secs.map((s) => s.name);
  const order = SECTIONS.filter((s) => names.includes(s));
  for (const s of SECTIONS) if (!names.includes(s)) say(`missing section "## ${s}"`);
  if (names.filter((n) => SECTIONS.includes(n)).join('|') !== order.join('|')) say('sections are not in the order Goal, Why it matters, Steps, Done when, Evidence, If it goes wrong, Stop and ask the owner if, Log');
  const sec = (n) => (secs.find((s) => s.name === n) || { text: '' }).text;

  const active = ['in-progress', 'review', 'verify', 'done'].includes(fm.status);
  if (fm.status === 'ready' || active) {
    if (!sec('Goal')) say('Goal is empty');
    if (!/^\s*\d+\.\s+\S/m.test(sec('Steps'))) say('Steps needs at least one numbered step');
    if (!/^\s*[-*]\s+\S/m.test(sec('Done when'))) say('Done when needs at least one line starting with "-"');
    if (!sec('If it goes wrong')) say('If it goes wrong is empty');
    if (fm.owner !== 'human' && Array.isArray(fm.paths) && fm.paths.length === 0) say('paths is empty (only a human-only card may have no paths)');
  }
  if (fm.risk === 'red' && (fm.status === 'ready' || active) && !(fm['approved-by'] || '').trim()) say('a red card needs "approved-by:" (owner name and date) before it is ready');
  if (['in-progress', 'review', 'verify'].includes(fm.status) && !(fm['claimed-by'] || '').trim()) say('claimed-by is empty');
  if (fm.status === 'blocked' && !(fm['blocked-by'] || '').trim()) say('a blocked card needs "blocked-by:"');
  if ((fm.status === 'review' || fm.status === 'verify' || fm.status === 'done') && !evidenceOk(sec('Evidence'))) say('Evidence is empty or still the placeholder');
  if (fm.status === 'done' && !sec('Log')) say('Log needs a handoff line');
  if (hasSecret(text)) say('looks like a secret (token or key) is written in the card; remove it');
  return bad;
}

/** Checks all cards together: unique ids, needs exist, one in-progress card per claimer, no shared paths. */
export function lintAll(cards) {
  const bad = [];
  const parsed = cards.map((c) => ({ ...c, fm: parseCard(c.text).fm, id: c.file.replace(/^.*\//, '').replace(/\.md$/, '') }));
  for (const c of cards) bad.push(...lintCard(c));
  const seen = new Map();
  for (const c of parsed) {
    if (seen.has(c.id)) bad.push(`${c.file}: id ${c.id} is also used by ${seen.get(c.id)}`);
    else seen.set(c.id, c.file);
  }
  for (const c of parsed) {
    for (const n of Array.isArray(c.fm.needs) ? c.fm.needs : []) if (/^T-\d{4}$/.test(n) && !seen.has(n)) bad.push(`${c.file}: needs ${n}, but no such card exists`);
  }
  const live = parsed.filter((c) => c.fm.status === 'in-progress');
  const byClaimer = new Map();
  for (const c of live) {
    const who = String(c.fm['claimed-by'] || '').replace(/[,;]?\s*\d{4}-\d{2}-\d{2}.*$/, '').trim().toLowerCase();
    if (who && byClaimer.has(who)) bad.push(`${c.file}: ${who} already has ${byClaimer.get(who)} in progress (one at a time)`);
    else if (who) byClaimer.set(who, c.id);
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i].fm.paths || [], b = live[j].fm.paths || [];
    if (a.some((x) => b.some((y) => overlap(String(x), String(y))))) bad.push(`${live[i].file} and ${live[j].file}: two in-progress cards share a path`);
  }
  return bad;
}
