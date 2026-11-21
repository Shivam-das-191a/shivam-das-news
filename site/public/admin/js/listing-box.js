// The "Search engine listing" box (PLAN 33.2). It shows the preview and wraps the three fields the editor already has
// (meta title, meta description, handle). The rules come from listing.js; this file only draws them.
// Every text goes in as a text node (h() in ui.js), never as HTML.
import { h } from './ui.js';
import { listing, entryListing, checkLimits, hardErrors, changeHandle, hideFromSearch, shareCard, checkCanonical, TITLE_WARN, DESC_WARN, OG_TITLE_WARN, OG_DESC_WARN } from './listing.js';

/** What the preview shows for a mode. Pure, so it can be tested without a screen. */
export function previewParts(l, mode, host) {
  const trail = l.path ? l.path.split('/').filter(Boolean).slice(-2) : [];
  return {
    site: host || '',
    crumb: mode === 'desktop' ? [host || '', ...trail].filter(Boolean).join(' \u203a ') : (host || ''),
    title: l.shown.title || 'Headline',
    description: l.shown.description || 'Meta description appears here.',
  };
}

/** True when a robots value hides the page from search engines (any value that holds noindex). Pure. */
export const isHidden = (robots) => /noindex/i.test(String(robots ?? ''));

/** A picture address that is safe to put in <img src> for the preview: a site path, https/http, or a preview made by the dashboard. Pure. */
export function safePreviewSrc(value) {
  const v = String(value ?? '').trim();
  return /^(https?:\/\/|\/(?!\/)|blob:|data:image\/)/i.test(v) ? v : '';
}

const levelClass = (lv) => (lv === 'stop' ? 'stop' : lv === 'warn' ? 'warn' : 'ok');

/**
 * opts: {
 *   d,                 the post data object of the editor (read live)
 *   getBody,           () => the Markdown body (for the automatic description)
 *   inputs,            { title, description, handle }: the editor's own input elements (metaTitle, description, permalink)
 *   ctx,               () => { siteName, origin, timeZone }
 *   others,            () => [{ id, permalink, category, date }] other posts, for the repeated handle error
 *   selfId,            the id of this post in `others`
 *   readOnly, startOpen,
 *   handleIsAuto,      () => true while the handle still follows the headline
 *   orig,              the saved state of an existing post: { status, permalink, category, date }, or null for a new post
 *   now,               () => the current Date (a test can fix it)
 *   onReset            (key) => void, key is 'title', 'description' or 'handle'; the editor clears the value and its own state
 *   canHide,           true when the role may switch noindex (editor and admin, PLAN 33); default true
 *   onHide             (on) => void, the editor writes d.robots from hideFromSearch() and keeps its Robots list in step
 *   Advanced fold (Phase 3b Part 5b), drawn only when inputs holds ogTitle, ogDescription and ogImage; canonical and schemaType are optional:
 *   inputs.ogTitle, inputs.ogDescription, inputs.ogImage, inputs.canonical, inputs.schemaType: the editor's own input elements
 *   canCanonical       true when the role may change the canonical address (editor and admin, PLAN 33); default true
 *   previewSrc         (path) => address for the share picture preview (the editor knows pictures that are not saved yet)
 *   onReset also gets 'ogTitle', 'ogDescription' and 'ogImage' (the last one is "Use the featured image")
 * }
 * Returns { el, refresh, isOpen, setMode, keepRedirect, isHidden }.
 * `others` items may carry `status`; a draft or archived post does not own its handle (LOGICS 21).
 */
export function listingBox(opts) {
  const { d, inputs, readOnly } = opts;
  let mode = 'mobile';
  let open = Boolean(opts.startOpen);
  let keep = true; // the 301 choice for a handle change on a young post

  const crumb = h('div', { class: 'u', 'data-l': 'crumb' });
  const title = h('div', { class: 't', 'data-l': 'title' });
  const desc = h('div', { class: 'd', 'data-l': 'desc' });
  const serp = h('div', { class: 'serp', 'data-mode': mode }, crumb, title, desc);

  const modeBtn = (m, label) => h('button', { type: 'button', 'data-l': 'mode-' + m, 'aria-pressed': String(mode === m), onclick: () => setMode(m) }, label);
  const mobileBtn = modeBtn('mobile', 'Mobile');
  const desktopBtn = modeBtn('desktop', 'Desktop');
  const editBtn = h('button', { type: 'button', 'data-l': 'edit', 'aria-expanded': String(open), onclick: () => toggle() }, open ? 'Close' : 'Edit');

  const mkCounter = (key) => h('span', { class: 'counter', 'data-l': 'count-' + key });
  const mkAuto = (key) => h('span', { class: 'auto-tag', 'data-l': 'auto-' + key }, 'auto');
  const mkReset = (key) => h('button', { type: 'button', class: 'link', 'data-l': 'reset-' + key, disabled: readOnly, onclick: () => { opts.onReset(key); refresh(); } }, 'Reset to auto');
  const c = { title: mkCounter('title'), description: mkCounter('description'), handle: mkCounter('handle') };
  const a = { title: mkAuto('title'), description: mkAuto('description'), handle: mkAuto('handle') };
  const r = { title: mkReset('title'), description: mkReset('description'), handle: mkReset('handle') };

  const row = (key, label, input, hint) => h('div', { class: 'lrow' },
    h('div', { class: 'lhead' }, h('label', null, label, ' ', a[key]), c[key], r[key]),
    input,
    h('div', { class: 'hint' }, hint));
  const prefixEl = h('div', { class: 'addr-prefix', 'data-l': 'prefix' });
  const handleRow = h('div', { class: 'lrow' },
    h('div', { class: 'lhead' }, h('label', null, 'URL handle', ' ', a.handle), c.handle, r.handle),
    prefixEl, inputs.handle,
    h('div', { class: 'hint' }, 'Lowercase letters, numbers and hyphens. The fixed part of the address cannot be changed here.'));
  const panel = h('div', { class: 'lpanel', 'data-l': 'panel', hidden: !open },
    row('title', 'Page title', inputs.title, `Empty means the headline and the site name. Google usually cuts after ${TITLE_WARN} characters.`),
    row('description', 'Meta description', inputs.description, `Empty means the first paragraph, cut at a word end. Google usually cuts after ${DESC_WARN} characters.`),
    handleRow);
  const notes = h('ul', { class: 'lnotes', 'data-l': 'notes' });
  // The question of PLAN 33.2: shown only when the handle of a published post is changed.
  const keepBox = h('input', { type: 'checkbox', 'data-l': 'redirect', checked: true, onchange: (e) => { keep = e.target.checked; } });
  const redirectText = h('span', { 'data-l': 'redirect-text' });
  const redirectBox = h('div', { class: 'lredirect', 'data-l': 'redirect-box', hidden: true }, h('label', null, keepBox, ' ', redirectText));

  // PLAN 33.2 "Hide this page from search engines": robots noindex,follow, out of the sitemaps and push (LOGICS 21 hideFromSearch).
  const canHide = opts.canHide !== false;
  const hideBox = h('input', { type: 'checkbox', 'data-l': 'hide', checked: isHidden(d.robots), onchange: (e) => { if (opts.onHide) opts.onHide(e.target.checked); refresh(); } });
  const hideInfo = h('div', { class: 'hint', 'data-l': 'hide-info', hidden: true });
  const hideWarn = h('div', { class: 'lhide-warn', 'data-l': 'hide-warn', role: 'alert', hidden: true });
  const hideRow = h('div', { class: 'lhide', 'data-l': 'hide-row' }, h('label', null, hideBox, ' Hide this page from search engines'), hideInfo, hideWarn);


  // ---- Advanced fold (PLAN 33.2, Part 5b): share card, canonical address, schema type. Data and rules are in listing.js (Part 5a). ----
  const hasAdv = Boolean(inputs.ogTitle && inputs.ogDescription && inputs.ogImage);
  const canCanonical = opts.canCanonical !== false;
  let advOpen = false;
  const advBtn = h('button', { type: 'button', 'data-l': 'adv-toggle', 'aria-expanded': 'false', onclick: () => toggleAdv() }, 'Advanced');
  const shImg = h('img', { alt: '', 'data-l': 'share-img', hidden: true });
  const shNoImg = h('div', { class: 'share-noimg', 'data-l': 'share-noimg' }, 'No picture');
  const shHost = h('div', { class: 'mute', 'data-l': 'share-host' });
  const shTitle = h('b', { 'data-l': 'share-title' });
  const shDesc = h('div', { class: 'mute', 'data-l': 'share-desc' });
  const shareEl = h('div', { class: 'sharecard', 'data-l': 'share' }, shImg, shNoImg, h('div', { class: 'sharetext' }, shHost, shTitle, shDesc));
  const shNote = h('div', { class: 'hint', 'data-l': 'share-note' });
  const ogCount = { title: mkCounter('ogTitle'), description: mkCounter('ogDescription') };
  const ogAuto = { title: mkAuto('ogTitle'), description: mkAuto('ogDescription'), image: mkAuto('ogImage') };
  const ogReset = { title: mkReset('ogTitle'), description: mkReset('ogDescription') };
  const advRow = (key, label, input, hint) => h('div', { class: 'lrow' },
    h('div', { class: 'lhead' }, h('label', null, label, ' ', ogAuto[key]), ogCount[key], ogReset[key]),
    input, h('div', { class: 'hint' }, hint));
  const useFeatured = h('button', { type: 'button', class: 'link', 'data-l': 'use-featured', disabled: readOnly, onclick: () => { opts.onReset('ogImage'); refresh(); } }, 'Use the featured image');
  const imageRow = hasAdv ? h('div', { class: 'lrow' },
    h('div', { class: 'lhead' }, h('label', null, 'Share picture', ' ', ogAuto.image), useFeatured),
    inputs.ogImage,
    h('div', { class: 'hint' }, 'Empty means the featured image. A file of the site starts with /.')) : null;
  const canonInfo = h('div', { class: 'hint', 'data-l': 'canon-info' });
  const canonRow = hasAdv && inputs.canonical ? h('div', { class: 'lrow' }, h('label', null, 'Canonical URL'), inputs.canonical,
    h('div', { class: 'hint' }, 'Leave empty: the page then names its own address. Fill it only when this story is a copy of a page elsewhere.'), canonInfo) : null;
  const schemaRow = hasAdv && inputs.schemaType ? h('div', { class: 'lrow' }, h('label', null, 'Schema type'), inputs.schemaType,
    h('div', { class: 'hint' }, 'NewsArticle suits news. Article and BlogPosting are for analysis and opinion.')) : null;
  const advPanel = hasAdv ? h('div', { class: 'ladv', 'data-l': 'adv', hidden: true },
    h('div', { class: 'mute' }, 'Share card preview (what a chat app or social site shows)'), shareEl, shNote,
    advRow('title', 'Share title', inputs.ogTitle, `Empty means the page title. Apps usually cut after ${OG_TITLE_WARN} characters.`),
    advRow('description', 'Share description', inputs.ogDescription, `Empty means the meta description. Apps usually cut after ${OG_DESC_WARN} characters.`),
    imageRow, canonRow, schemaRow) : null;

  const el = h('div', { class: 'card listing', 'data-l': 'box' },
    h('div', { class: 'lhead' }, h('h2', null, 'Search engine listing'), h('span', { class: 'lmodes', role: 'group', 'aria-label': 'Preview size' }, mobileBtn, desktopBtn), editBtn, hasAdv ? advBtn : null),
    serp, panel, redirectBox, hideRow, advPanel, notes);

  function setMode(m) {
    mode = m;
    serp.setAttribute('data-mode', m);
    mobileBtn.setAttribute('aria-pressed', String(m === 'mobile'));
    desktopBtn.setAttribute('aria-pressed', String(m === 'desktop'));
    refresh();
  }
  function toggle() {
    open = !open;
    panel.hidden = !open;
    editBtn.setAttribute('aria-expanded', String(open));
    editBtn.textContent = open ? 'Close' : 'Edit';
  }

  function toggleAdv() {
    advOpen = !advOpen;
    if (advPanel) advPanel.hidden = !advOpen;
    advBtn.setAttribute('aria-expanded', String(advOpen));
    advBtn.textContent = advOpen ? 'Close advanced' : 'Advanced';
  }

  function refreshAdvanced(l, cx) {
    const sc = shareCard(d, { origin: cx.origin });
    shHost.textContent = sc.host;
    shTitle.textContent = sc.shown.title || 'Headline';
    shDesc.textContent = sc.shown.description || 'No description yet.';
    const raw = sc.image ? (opts.previewSrc ? opts.previewSrc(sc.image) : sc.imageUrl) : '';
    const src = safePreviewSrc(raw);
    if (src) shImg.setAttribute('src', src); else shImg.removeAttribute('src');
    shImg.hidden = !src;
    shNoImg.hidden = Boolean(src);
    shNote.textContent = sc.image ? '' : 'No share picture: the site default picture is used.';
    ogAuto.title.hidden = !sc.auto.title;
    ogAuto.description.hidden = !sc.auto.description;
    ogAuto.image.hidden = !sc.auto.image;
    ogReset.title.hidden = sc.auto.title || Boolean(readOnly);
    ogReset.description.hidden = sc.auto.description || Boolean(readOnly);
    useFeatured.hidden = sc.auto.image || Boolean(readOnly);
    ogCount.title.textContent = `${sc.counts.title}/${OG_TITLE_WARN}`;
    ogCount.title.className = 'counter ' + levelClass(sc.levels.title);
    ogCount.description.textContent = `${sc.counts.description}/${OG_DESC_WARN}`;
    ogCount.description.className = 'counter ' + levelClass(sc.levels.description);
    // The canonical address: locked for a role that may not change it; the check text only when it is a warning (a stop is already in the red list).
    const cn = inputs.canonical ? checkCanonical(d.canonical, { selfUrl: l.url, origin: cx.origin }) : { level: 'ok', notes: [] };
    if (inputs.canonical) inputs.canonical.disabled = Boolean(readOnly) || !canCanonical;
    canonInfo.textContent = !canCanonical ? 'Only editors and admins can change this.' : cn.level === 'warn' ? cn.notes.join(' ') : '';
    const warns = [];
    for (const t of sc.notes) if (!/the limit is/.test(t) && !/^No share picture/.test(t)) warns.push(t);
    if (cn.level === 'warn') warns.push(...cn.notes);
    return { warns };
  }

  function refresh() {
    const cx = opts.ctx();
    const l = listing({ ...d, body: opts.getBody() }, cx);
    const host = cx.origin ? safeHost(cx.origin) : '';
    const p = previewParts(l, mode, host);
    crumb.textContent = p.crumb;
    title.textContent = p.title;
    desc.textContent = p.description;
    const auto = { title: l.auto.title, description: l.auto.description, handle: opts.handleIsAuto ? opts.handleIsAuto() : l.auto.handle };
    const lim = checkLimits({ title: l.title, description: l.description, handle: l.handle });
    for (const key of ['title', 'description', 'handle']) {
      const max = key === 'title' ? TITLE_WARN : key === 'description' ? DESC_WARN : null;
      c[key].textContent = max ? `${l.counts[key]}/${max}` : String(l.counts[key]);
      c[key].className = 'counter ' + levelClass(lim[key]);
      a[key].hidden = !auto[key];
      r[key].hidden = auto[key] || Boolean(readOnly);
    }
    prefixEl.textContent = l.url ? l.url.slice(0, l.url.length - l.handle.length - 1) : '/\u2026/';
    const errs = hardErrors({ ...d, date: d.date || new Date().toISOString() }, { timeZone: cx.timeZone, others: opts.others ? opts.others() : [], selfId: opts.selfId });
    const o = opts.orig;
    const ch = o ? changeHandle({ ...d, status: o.status, permalink: o.permalink, category: o.category, date: o.date }, d.permalink, { now: opts.now ? opts.now() : new Date(), others: opts.others ? opts.others() : [], selfId: opts.selfId }) : null;
    const ask = Boolean(ch && ch.ok && ch.changed && ch.redirect !== 'none');
    if (!ask) keep = true;
    if (ch && ch.ok && ch.redirect === 'required') keep = true;
    redirectBox.hidden = !ask;
    keepBox.checked = keep;
    keepBox.disabled = Boolean(readOnly) || !ask || ch.redirect === 'required';
    redirectText.textContent = !ask ? '' : ch.redirect === 'required'
      ? 'This post has been live for more than 24 hours, so the old address will redirect (301) to the new one. This cannot be switched off.'
      : 'Create a 301 redirect from the old address to the new one? Recommended; the old address stops working if you switch it off.';
    const hidden = isHidden(d.robots);
    const hide = hideFromSearch(d, hidden);
    hideBox.checked = hidden;
    hideBox.disabled = Boolean(readOnly) || !canHide;
    hideInfo.hidden = !hidden && canHide;
    hideInfo.textContent = !canHide ? 'Only editors and admins can change this.'
      : hidden ? 'Search engines are told not to list this page (noindex, follow). It is left out of the sitemaps, the news sitemap and push notifications.' : '';
    hideWarn.hidden = !hide.warnBreaking;
    hideWarn.textContent = hide.warnBreaking ? 'This post is marked Breaking or Featured, but it is hidden from search engines and will not be announced by push. Switch the hiding off if readers should find it.' : '';
    const adv = hasAdv ? refreshAdvanced(l, cx) : { warns: [] };
    const clash = ch && !ch.ok && ch.error && d.permalink ? [ch.error] : [];
    notes.replaceChildren(...clash.map((t) => h('li', { class: 'stop', 'data-l': 'error' }, t)), ...errs.map((t) => h('li', { class: 'stop', 'data-l': 'error' }, t)), ...lim.notes.map((t) => h('li', { class: 'warn', 'data-l': 'note' }, t)), ...adv.warns.map((t) => h('li', { class: 'warn', 'data-l': 'note' }, t)));
    return l;
  }

  for (const k of ['title', 'description', 'handle']) inputs[k].addEventListener('input', () => refresh());
  if (hasAdv) for (const k of ['ogTitle', 'ogDescription', 'ogImage', 'canonical', 'schemaType']) {
    if (!inputs[k]) continue;
    inputs[k].addEventListener('input', () => refresh());
    inputs[k].addEventListener('change', () => refresh());
  }
  refresh();
  return { el, refresh, isOpen: () => open, isAdvancedOpen: () => advOpen, toggleAdvanced: toggleAdv, setMode, keepRedirect: () => keep, isHidden: () => isHidden(d.robots) };
}

function safeHost(origin) {
  try { return new URL(origin).host; } catch { return String(origin); }
}

/**
 * Part 6b (v0.101.24): the same box for a category or an author (PLAN 33.2). Two fields: search title and search description.
 * opts: {
 *   getEntry,   () => { title, description, metaTitle, metaDescription } read live from the screen
 *   inputs,     { metaTitle, metaDescription }: the screen's own input elements
 *   ctx,        () => { siteName, origin, path }
 *   readOnly, startOpen,
 *   onReset     (key) => void, key is 'title' or 'description'; the screen clears the input
 *   hints       optional { title, description }: other help texts under the two fields (the home page uses them)
 *   ctx may also hold autoTitle (see entryListing)
 * }
 * Returns { el, refresh, isOpen, setMode }.
 */
export function entryBox(opts) {
  const { inputs, readOnly } = opts;
  let mode = 'mobile';
  let open = Boolean(opts.startOpen);
  const crumb = h('div', { class: 'u', 'data-l': 'crumb' });
  const title = h('div', { class: 't', 'data-l': 'title' });
  const desc = h('div', { class: 'd', 'data-l': 'desc' });
  const serp = h('div', { class: 'serp', 'data-mode': mode }, crumb, title, desc);
  const modeBtn = (m, label) => h('button', { type: 'button', 'data-l': 'mode-' + m, 'aria-pressed': String(mode === m), onclick: () => setMode(m) }, label);
  const mobileBtn = modeBtn('mobile', 'Mobile');
  const desktopBtn = modeBtn('desktop', 'Desktop');
  const editBtn = h('button', { type: 'button', 'data-l': 'edit', 'aria-expanded': String(open), onclick: () => toggle() }, open ? 'Close' : 'Edit');
  const counter = (key) => h('span', { class: 'counter', 'data-l': 'count-' + key });
  const autoTag = (key) => h('span', { class: 'auto-tag', 'data-l': 'auto-' + key }, 'auto');
  const reset = (key) => h('button', { type: 'button', class: 'link', 'data-l': 'reset-' + key, disabled: readOnly, onclick: () => { opts.onReset(key); refresh(); } }, 'Reset to auto');
  const c = { title: counter('title'), description: counter('description') };
  const a = { title: autoTag('title'), description: autoTag('description') };
  const r = { title: reset('title'), description: reset('description') };
  const row = (key, label, input, hint) => h('div', { class: 'lrow' }, h('div', { class: 'lhead' }, h('label', null, label, ' ', a[key]), c[key], r[key]), input, h('div', { class: 'hint' }, hint));
  const panel = h('div', { class: 'lpanel', 'data-l': 'panel', hidden: !open },
    row('title', 'Search title', inputs.metaTitle, (opts.hints && opts.hints.title) || `Empty means the name and the site name. Google usually cuts after ${TITLE_WARN} characters.`),
    row('description', 'Search description', inputs.metaDescription, (opts.hints && opts.hints.description) || `Empty means the text shown on the page. Google usually cuts after ${DESC_WARN} characters.`));
  const notes = h('ul', { class: 'lnotes', 'data-l': 'notes' });
  const el = h('div', { class: 'card listing', 'data-l': 'box' },
    h('div', { class: 'lhead' }, h('h2', null, 'Search engine listing'), h('span', { class: 'lmodes', role: 'group', 'aria-label': 'Preview size' }, mobileBtn, desktopBtn), editBtn),
    serp, panel, notes);

  function setMode(m) {
    mode = m;
    serp.setAttribute('data-mode', m);
    mobileBtn.setAttribute('aria-pressed', String(m === 'mobile'));
    desktopBtn.setAttribute('aria-pressed', String(m === 'desktop'));
    refresh();
  }
  function toggle() {
    open = !open;
    panel.hidden = !open;
    editBtn.setAttribute('aria-expanded', String(open));
    editBtn.textContent = open ? 'Close' : 'Edit';
  }
  function refresh() {
    const cx = opts.ctx();
    const l = entryListing(opts.getEntry(), cx);
    const host = cx.origin ? safeHost(cx.origin) : '';
    const trail = l.path ? l.path.split('/').filter(Boolean).slice(-2) : [];
    crumb.textContent = mode === 'desktop' ? [host, ...trail].filter(Boolean).join(' \u203a ') : host;
    title.textContent = l.shown.title || 'Title';
    desc.textContent = l.shown.description || 'Search description appears here.';
    c.title.textContent = `${l.counts.title}/${TITLE_WARN}`;
    c.title.className = 'counter ' + levelClass(l.levels.title);
    c.description.textContent = `${l.counts.description}/${DESC_WARN}`;
    c.description.className = 'counter ' + levelClass(l.levels.description);
    for (const key of ['title', 'description']) { a[key].hidden = !l.auto[key]; r[key].hidden = l.auto[key] || Boolean(readOnly); }
    notes.replaceChildren(...[...l.errors.map((t) => h('li', { class: 'stop' }, t)), ...l.notes.map((t) => h('li', { class: 'warn' }, t))]);
    return l;
  }
  refresh();
  return { el, refresh, isOpen: () => open, setMode };
}
