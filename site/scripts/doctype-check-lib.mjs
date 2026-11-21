// Part 8bf (POLISH, Doctype): every built page starts with <!doctype html>.
// A page with no doctype, a mistyped one (<!doctyp html>, <doctype html>) or one that does not come first is drawn by the browser in quirks mode: old box sizes,
// odd line heights, tables that ignore the font size. The browser shows no message, and the build did not read the first line of a page at all.
// Pure function, no files, no network.
//   checkDoctype(html): { errors, warnings }
//   errors:   no doctype on the page; a doctype that is a typo (<!doctyp html>, <doctype html> with no "!"); a doctype that does not come first (text or a tag before it);
//             a doctype with no name or a name that is not html (<!doctype htm>, <!doctype body>)
//   warnings: a doctype with an old public or system identifier (HTML 4.01, XHTML 1.0; only about:legacy-compat is fine); a second doctype; a comment before the doctype
// Read on: the start of the page (a byte order mark, blanks and comments are skipped); the case is not read (<!DOCTYPE HTML> is fine); the doctype word searched for a second one is read
//   with comments, <script>, <style> and <template> blocks taken out.
// Left out on purpose, so there is no false alarm: the form <!doctype html> with any case or blanks; <!doctype html system "about:legacy-compat">; a text that only mentions the word inside a script.
const SKIP = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const WORD = 'doctype';

/** Edit distance where swapping two neighbouring letters counts as one change (doctpye is a typo of doctype). */
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

const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

export function checkDoctype(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  let s = html.replace(/^﻿/, '');
  // Skip blanks and comments at the very start.
  let comments = 0;
  for (;;) {
    const t = s.replace(/^\s+/, '');
    const c = /^<!--[\s\S]*?-->/.exec(t);
    if (c) { comments++; s = t.slice(c[0].length); continue; }
    s = t;
    break;
  }
  if (s === '') { errors.push('the page has no <!doctype html>; the browser draws a page with no doctype in quirks mode (old box sizes and line heights)'); return { errors, warnings }; }

  const good = /^<!doctype(?=[\s>])([^>]*)>/i.exec(s);
  if (good) {
    const rest = good[1].trim();
    const m = /^([^\s"']*)\s*([\s\S]*)$/.exec(rest);
    const name = m ? m[1] : '';
    const ids = m ? m[2].trim() : '';
    if (name === '') errors.push('the doctype has no name; write <!doctype html>, or the browser draws the page in quirks mode');
    else if (name.toLowerCase() !== 'html') errors.push(`the doctype names "${short(name)}", not html; write <!doctype html>, or the browser draws the page in quirks mode`);
    else if (ids !== '' && !/^system\s+(["'])about:legacy-compat\1$/i.test(ids)) {
      warnings.push(`the doctype carries an old identifier (${short(ids)}); write <!doctype html>`);
    }
    if (comments > 0) warnings.push('a comment comes before the doctype; an old browser (Internet Explorer 9 and older) then draws the page in quirks mode, so put the doctype first');
    const after = s.slice(good[0].length).replace(SKIP, '');
    if (/<!doctype(?=[\s>])/i.test(after)) warnings.push('the page has a second doctype; the browser ignores it, remove it');
    return { errors, warnings };
  }

  // The first real thing on the page is not a doctype. A typo of it?
  const typo = /^<(!?)([a-z][a-z0-9]{3,11})(?=[\s>])/i.exec(s);
  if (typo) {
    const w = typo[2].toLowerCase();
    if (w === WORD && typo[1] === '') {
      errors.push('the doctype is written <doctype ...> with no "!"; write <!doctype html>, or the browser shows it as text and draws the page in quirks mode');
      return { errors, warnings };
    }
    if (typo[1] === '!' && w !== WORD && distance(w, WORD) <= 2) {
      errors.push(`the first line <!${short(typo[2])} ...> is a typo of <!doctype html>; the browser takes it for a comment and draws the page in quirks mode`);
      return { errors, warnings };
    }
  }

  // Is there a doctype later on? Then something comes before it.
  const later = s.replace(SKIP, '');
  if (/<!doctype(?=[\s>])/i.test(later)) {
    errors.push('the doctype does not come first (text or a tag stands before it); the browser then ignores it and draws the page in quirks mode');
    return { errors, warnings };
  }
  errors.push('the page has no <!doctype html>; the browser draws a page with no doctype in quirks mode (old box sizes and line heights)');
  return { errors, warnings };
}
