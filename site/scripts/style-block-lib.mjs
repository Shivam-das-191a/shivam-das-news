// Part 8bd (POLISH, Style blocks): the <style> blocks of a built page are written the way a browser can read them.
// A <style> block pasted by hand into a post or into the head (PLAN 37) is cut short by the browser, with no message, when one brace is missing:
// the rule is lost and every rule after it with it. A declaration with no colon, a property written backgroud or a size with no unit (width:300) is thrown away the same way.
// style-attr-lib.mjs reads the style="..." attributes; nothing read the <style> blocks. Pure function, no files, no network.
//   checkStyleBlocks(html): { errors, warnings }
//   errors:   a { that is never closed; a } with no opening one; a { with no selector before it; a comment /* that is never closed; a quote that is never closed;
//             inside a rule, everything style-attr-lib.mjs stops in an attribute: a declaration with no colon or no value, a property that is a typo of a real one,
//             a number with no unit in a length, a unit or a keyword that is a typo, a hex color that is not 3, 4, 6 or 8 digits, a bracket never closed,
//             two declarations joined with no semicolon, a ! that is not !important
//   warnings: an empty <style> block; the warnings of style-attr-lib.mjs (expression(, javascript:, the same property twice with the same value)
// Read on: every <style> block that has no type, or type="text/css" (the media attribute is not read); nested rules and at-rules (@media, @supports, @layer, @keyframes).
// Left out on purpose, so there is no false alarm: the selectors and the words of at-rules; the declarations inside @font-face, @property, @counter-style, @page,
//   @font-feature-values and @view-transition (they have their own words); custom properties and vendor properties (see style-attr-lib.mjs); a <style> whose tag or text holds a
//   template expression ({value}); text inside comments, <script> and <template>; a <style> of another type (type="text/less").
// Why: PLAN 37 lets the owner write code in a post, and the dashboard preview shows the page without the lost rules.
import { checkDeclarations } from './style-attr-lib.mjs';

const RE = /<!--[\s\S]*?-->|<template(?=[\s>/])[\s\S]*?<\/template\s*>|<script(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/script\s*>|<style(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/style\s*>/gi;
const TYPE = /(?:^|[\s"'/])type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const OWN_WORDS = /^@(?:font-face|property|counter-style|font-feature-values|page|view-transition)\b/i;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

/** Walks the CSS once and reports the rules with their declarations. */
function walk(css, err, warn, where) {
  let cur = '', quote = '', paren = 0;
  const stack = [{ prelude: '', parts: [] }];
  const finish = (frame) => {
    if (OWN_WORDS.test(frame.prelude)) return;
    if (!frame.parts.some((p) => p.trim())) return;
    const label = `${where}, rule "${short(frame.prelude.replace(/\s+/g, ' '))}"`;
    checkDeclarations(frame.parts, (m) => err(`${label}: ${m}`), (m) => warn(`${label}: ${m}`));
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      cur += c;
      if (c === '\\') cur += css[++i] ?? '';
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    if (paren > 0) { cur += c; continue; }
    if (c === ';') { stack[stack.length - 1].parts.push(cur); cur = ''; continue; }
    if (c === '{') {
      const prelude = cur.trim();
      if (!prelude) err(`${where}: a { has no selector before it, so the browser drops the rule`);
      stack.push({ prelude, parts: [] });
      cur = '';
      continue;
    }
    if (c === '}') {
      if (stack.length === 1) { err(`${where}: a } has no opening {, so the browser ends the rule too early`); cur = ''; continue; }
      const frame = stack.pop();
      if (cur.trim()) frame.parts.push(cur);
      cur = '';
      finish(frame);
      continue;
    }
    cur += c;
  }
  if (quote) err(`${where}: a quote is never closed, so the browser drops the rest of the style`);
  if (stack.length > 1) {
    err(`${where}: a { is never closed (rule "${short(stack[stack.length - 1].prelude.replace(/\s+/g, ' '))}"), so the browser drops it and every rule after it`);
  }
}

export function checkStyleBlocks(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, a template or a script
    const tagText = m[1] ?? '';
    const t = TYPE.exec(tagText);
    const type = t ? (t[1] ?? t[2] ?? t[3] ?? '').trim().toLowerCase() : '';
    if (type && type !== 'text/css') continue;
    if (/[{}]/.test(tagText)) continue; // a template expression in the tag
    const where = 'a <style> block';
    let css = m[2];
    if (!css.trim()) { warnings.push(`${where} is empty and does nothing; remove it`); continue; }
    if (/^\s*\{[^{}]*\}\s*$/.test(css) && !/:/.test(css)) continue; // a template expression as the whole text
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const open = css.indexOf('/*');
    if (open >= 0) {
      errors.push(`${where}: a comment /* is never closed, so the browser ignores the rest of the style`);
      css = css.slice(0, open);
    }
    if (!css.trim()) continue;
    walk(css, (msg) => errors.push(msg), (msg) => warnings.push(msg), where);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
