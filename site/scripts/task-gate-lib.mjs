// Phase 3k Part 5 (LOGICS 31.5, 31.6, 31.9): two gates. Pure functions; scripts/task-gate.mjs reads files and git.
//  - paths gate: a pull request named ai/T-0000 may change only the files its card allows.
//  - close gate: who may move a card to done (the second key).
import { parseCard, sectionsOf } from './task-lint-lib.mjs';

/** "ai/T-0006" or "human/T-0006" gives "T-0006"; anything else gives ''. */
export const cardOfBranch = (branch) => (/^(?:ai|human)\/(T-\d{4})$/.exec(String(branch || '').trim()) || [])[1] || '';

const clean = (p) => String(p).trim().replace(/^\.?\//, '');
const allowed = (file, entry) => {
  const e = clean(entry);
  if (!e) return false;
  return e.endsWith('/') ? file.startsWith(e) : file === e || file.startsWith(e + '/');
};

/** Files outside the card's paths. The card's own file (open or done) is always allowed. */
export function extraFiles(cardId, paths, changed) {
  const own = [`tasks/open/${cardId}.md`, `tasks/done/${cardId}.md`];
  return (changed || []).map(clean).filter(Boolean).filter((f) => !own.includes(f) && !(paths || []).some((p) => allowed(f, p)));
}

/** The name before the date in a "claimed-by" value, lowercase: "Claude (2026-11-16)" gives "claude". */
export const nameOf = (v) => String(v || '').replace(/\(?\s*\d{4}-\d{2}-\d{2}.*$/, '').replace(/[,;(\s]+$/, '').trim().toLowerCase();

/** The "Confirmed by <name>, <date>" lines in a Log: [{ name, date }]. */
export function confirmations(logText) {
  const out = [];
  for (const m of String(logText || '').matchAll(/Confirmed by\s+([^,\n]+?),\s*(\d{4}-\d{2}-\d{2})/gi)) out.push({ name: m[1].trim().toLowerCase(), date: m[2] });
  return out;
}

/**
 * May this card be closed (status done)? Returns a list of plain sentences, empty when it may.
 * owners = the logins allowed to close a red card (the ALLOWED_USERS list), lowercase or not.
 */
export function closeProblems(text, owners = []) {
  const { fm, body, error } = parseCard(text);
  if (error) return [error];
  const bad = [];
  const doer = nameOf(fm['claimed-by']);
  const logText = (sectionsOf(body).find((s) => s.name === 'Log') || { text: '' }).text;
  const ok = confirmations(logText);
  if (fm.risk === 'green') return bad;
  if (!doer) bad.push('claimed-by is empty, so nobody is named as the doer');
  const others = ok.filter((c) => c.name !== doer);
  if (ok.length && !others.length) bad.push(`the only confirmation is by the doer (${doer}); a second key must be someone else`);
  if (!ok.length) bad.push(`a ${fm.risk} card needs a Log line "Confirmed by <name>, <date>" from someone other than the doer`);
  if (fm.risk === 'red') {
    const list = owners.map((o) => String(o).trim().toLowerCase()).filter(Boolean);
    if (!list.length) bad.push('a red card is closed only by the owner; no owner names were given (--owners)');
    else if (!others.some((c) => list.includes(c.name))) bad.push('a red card is closed only by the owner; no confirmation is from an owner login');
  }
  return bad;
}
