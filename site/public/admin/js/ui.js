// Small DOM helpers (no framework).

// Icons: SVG only, never emojis (PLAN 29.3). Same drawings as src/lib/svg-icons.ts; tests/unit/no-emoji.test.ts checks they match.
export const ICONS = {
  'arrow-right': '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  alert: '<path d="M12 3L2 21h20z"/><path d="M12 10v5"/><path d="M12 18v.01"/>',
};
export function icon(name, size = 16) {
  const body = ICONS[name];
  if (!body) throw new Error(`Icon "${name}" does not exist`);
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ class: 'icon', width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' })) s.setAttribute(k, v);
  s.innerHTML = body; // fixed text from ICONS above, never from a visitor or a file
  return s;
}
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

export function toast(msg, bad = false) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 7000 : 3500);
}

export function modal(content) {
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === box) box.remove(); } }, h('div', null, content));
  document.body.append(box);
  return { close: () => box.remove() };
}

export async function busy(btn, fn) {
  btn.disabled = true;
  try { return await fn(); } catch (e) { toast(e.message || String(e), true); } finally { btn.disabled = false; }
}

export const field = (label, input, hint) => h('div', null, h('label', null, label, hint ? h('span', { class: 'hint' }, ' ' + hint) : null), input);

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
