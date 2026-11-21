// Dashboard (Phase 3). Static app: talks to GitHub directly with the signed-in person's token.
import { h, toast, modal, busy, field, debounce, icon } from './ui.js';
import { GitHub, joinPath } from './github.js';
import { parse, stringify } from './frontmatter.js';
import { slugify, uniqueSlug, SLUG_RE } from './slug.js';
import { postUrl, zonedToUtc, utcToZoned } from './url.js';
import { analyze, truncate } from './seo.js';
import { listingBox, entryBox } from './listing-box.js';
import { hideFromSearch, mergeEntry, entryErrors } from './listing.js';
import { validatePost, MIN_IMAGE_WIDTH, PUSH_TITLE_MAX, PUSH_BODY_MAX } from './validate.js';
import { PUSH_CHOICES, pushValue, pushPreview, pushCount, cleanPush, pushNote } from './push-fields.js';
import { nextRedirects, cleanEntry, parseCsv, toCsv } from './redirects.js';
import { parseXml, planImport } from './import-xml.js';
import { buildImportFiles, batches } from './import-save.js';
import { collectImages, downloadAll, applyImages, chunks } from './import-images.js';
import { buildExport, exportName } from './export-xml.js';
import { readLinks, cleanLink, writeLinks } from './link-list.js';
import { planRename } from './category-rename.js';
import { readAds, configFromForm, buildAdsTxt as adsTxt, writeAds } from './ads-config.js';
import { readLoader, configFromForm as loaderFromForm, adLoaderPlan, describePlan, writeLoader } from './ad-loader-config.js';
import { can, roleOf } from './roles.js';
import { COLUMNS, COLUMN_LABEL, readCard, parseDecisions, board as taskBoard, waitingForOwner, blockingDecisions, unmetNeeds, aiPrompt } from './tasks.js';
import { renderMarkdown } from './md.js';
import { prepareImage, sizeOf, mediaName } from './image.js';
import { filesScreen } from './files-screen.js';
import { imagesScreen } from './images-screen.js';
import { imagesFormScreen } from './images-form-screen.js';
import { imagesPathOf } from './images-setting.js';
import { saveImagesSettings } from './images-save.js';
import { planFileRename } from './file-rename.js';
import { planReplace, mapWithoutVariants } from './file-replace.js';
import { RAW_ACTION, rawText, parseRaw, rawGuard, rawUnchanged } from './file-tab.js';
import { bulkAltScreen } from './bulk-alt.js';
import { mergeMedia, mergeAltBulk, mediaErrors, deleteCheck, replaceCheck, pictureKind } from './media-meta.js';
import { RANGES as AN_RANGES, statsUrl, readEndpoint, statsError, zoneList, renderStats } from './analytics.js';
import { runHostingSave, freshOrig } from './hosting-hook.js';
import { planDelete, mapWithout } from './file-delete.js';
import { LAST_DONE_KEY, securitySummary, reviewLists, readLastDone, markDone, writeLastDone, renderSecurity } from './security.js';

const S = { cfg: null, gh: null, user: null, role: null, repo: null, site: {}, siteSha: '', tree: [], posts: null, authors: [], cats: {}, previews: new Map(), sizes: new Map(), root: null, app: null };
const IMG_RE = /\.(webp|jpe?g|png|gif|svg|avif)$/i;
const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'CCBot', 'Google-Extended', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Bytespider', 'Applebot-Extended', 'Amazonbot'];
let dirty = false;

const P = () => {
  const r = S.cfg.contentRoot;
  return { posts: joinPath(r, 'content/blogs'), pages: joinPath(r, 'content/pages'), authors: joinPath(r, 'content/authors'), media: joinPath(r, 'public/media'), site: joinPath(r, 'config/site.json'), robots: joinPath(r, 'config/robots.json'), cats: joinPath(r, 'config/categories.json'), redirects: joinPath(r, 'config/redirects.json'), links: joinPath(r, 'config/links.json'), ads: joinPath(r, 'config/ads.json'), adLoader: joinPath(r, 'config/ad-loader.json'), analytics: joinPath(r, 'config/analytics.json'), mediaMeta: joinPath(r, 'config/media.json'), pub: joinPath(r, 'public') };
};
const tz = () => S.site.timeZone || 'UTC';
const fmt = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: tz(), dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const statusOf = (d) => (d.status === 'published' && new Date(d.date) > new Date() ? 'scheduled' : d.status || 'draft');
const cache = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* full */ } } };

// ---------- start ----------
export async function boot(root) {
  S.app = root;
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', () => { if (S.gh) route(); });
  try { S.cfg = await (await fetch('/admin/config.json', { cache: 'no-store' })).json(); } catch { S.cfg = null; }
  if (!S.cfg || !S.cfg.repo) return screen(h('div', { class: 'card login' }, h('h1', null, 'Dashboard not set up'), h('p', null, 'Open ', h('code', null, 'site/public/admin/config.json'), ' and set ', h('code', null, 'repo'), ' (for example your-name/your-repo). See site/README.md, Phase 3 setup.')));
  const token = cache.get('adm.token');
  if (token) return start(token);
  loginView();
}

function screen(...kids) { S.app.replaceChildren(...kids); }

function loginView(msg) {
  const tokenBox = h('input', { type: 'password', placeholder: 'GitHub personal access token', autocomplete: 'off' });
  screen(h('div', { class: 'card login' },
    h('h1', null, 'Sign in'),
    msg ? h('p', { class: 'mute' }, msg) : null,
    S.cfg.authUrl
      ? h('button', { class: 'primary', onclick: signInPopup }, 'Sign in with GitHub')
      : h('p', { class: 'mute' }, 'GitHub sign-in is not connected yet (authUrl is empty). Use a token below.'),
    h('details', { style: 'margin-top:1rem;text-align:left' }, h('summary', null, 'Use a personal access token instead'),
      field('Fine-grained token with Contents: read and write on this repo', tokenBox),
      h('p', null, h('button', { onclick: () => { if (tokenBox.value.trim()) { cache.set('adm.token', tokenBox.value.trim()); start(tokenBox.value.trim()); } } }, 'Continue')))));
}

function signInPopup() {
  const origin = new URL(S.cfg.authUrl).origin;
  const win = window.open(`${origin}/auth`, 'adm-auth', 'width=560,height=720');
  const onMsg = (e) => {
    if (e.origin !== origin || !e.data || e.data.type !== 'shivam-admin-auth') return;
    window.removeEventListener('message', onMsg);
    cache.set('adm.token', e.data.token);
    if (win) win.close();
    start(e.data.token);
  };
  window.addEventListener('message', onMsg);
}

async function start(token) {
  screen(h('p', { class: 'boot' }, 'Signing in…'));
  try {
    S.gh = new GitHub({ token, repo: S.cfg.repo, branch: S.cfg.branch });
    S.user = await S.gh.user();
    S.repo = await S.gh.repoInfo();
    S.role = roleOf(S.cfg, S.user.login, S.repo.permissions || {});
    if (!S.role) throw new Error(`${S.user.login} has no role. Add it to roles in admin/config.json.`);
    S.tree = await S.gh.tree();
    await loadSite();
    route();
  } catch (e) {
    try { sessionStorage.removeItem('adm.token'); } catch { /* ignore */ }
    S.gh = null;
    loginView(e.message);
  }
}

async function loadSite() {
  const p = P();
  try { const f = await S.gh.getText(p.site); S.site = JSON.parse(f.text); S.siteSha = f.sha; } catch { S.site = {}; }
  try { S.cats = JSON.parse((await S.gh.getText(p.cats)).text); } catch { S.cats = {}; }
}

// ---------- shell and router ----------
const NAV = [['#/', 'Posts'], ['#/post/new', 'New post'], ['#/media', 'Media'], ['#/files', 'Files', 'media'], ['#/authors', 'Authors'], ['#/categories', 'Categories'], ['#/redirects', 'Redirects', 'redirects'], ['#/import', 'Import', 'import'], ['#/export', 'Export', 'export'], ['#/links', 'Links', 'links'], ['#/ads', 'Ads', 'ads'], ['#/ad-loader', 'Ad loader', 'ads'], ['#/analytics', 'Analytics', 'analytics'], ['#/security', 'Security', 'analytics'], ['#/tasks', 'Tasks', 'tasks'], ['#/images', 'Picture settings', 'settings'], ['#/settings', 'Settings', 'settings'], ['#/setup', 'Setup']];

function shell(title, ...content) {
  const cur = location.hash || '#/';
  const nav = h('nav', null, NAV.filter((n) => !n[2] || can(S.role, n[2])).map(([href, label]) => h('a', { href, 'aria-current': cur === href || (href === '#/' && cur.startsWith('#/post/') && cur !== '#/post/new') ? 'page' : null }, label)));
  screen(h('header', { class: 'top' }, h('strong', null, S.site.siteName || 'Dashboard'), nav,
    h('span', { class: 'mute' }, `${S.user.login} (${S.role})`),
    h('button', { onclick: () => { sessionStorage.removeItem('adm.token'); S.gh = null; S.posts = null; loginView(); } }, 'Sign out')),
    h('main', null, h('h1', null, title), ...content));
}

function route() {
  const hash = location.hash || '#/';
  stopAnalytics();
  if (hash === '#/' || hash === '') return postsView();
  if (hash === '#/post/new') return editorView(null);
  if (hash.startsWith('#/post/')) return editorView(decodeURIComponent(hash.slice(7)));
  if (hash === '#/media') return mediaView();
  if (hash === '#/files') return filesView();
  if (hash === '#/files/alt') return bulkAltView();
  if (hash === '#/authors') return authorsView();
  if (hash === '#/categories') return categoriesView();
  if (hash === '#/redirects') return can(S.role, 'redirects') ? redirectsView() : shell('Redirects', h('p', null, 'Your role cannot manage redirects.'));
  if (hash === '#/import') return can(S.role, 'import') ? importView() : shell('Import', h('p', null, 'Your role cannot import.'));
  if (hash === '#/ads') return can(S.role, 'ads') ? adsView() : shell('Ads', h('p', null, 'Only admins can change the ad settings.'));
  if (hash === '#/ad-loader') return can(S.role, 'ads') ? adLoaderView() : shell('Ad loader', h('p', null, 'Only admins can change the ad settings.'));
  if (hash === '#/analytics') return can(S.role, 'analytics') ? analyticsView() : shell('Analytics', h('p', null, 'Only admins can see the analytics.'));
  if (hash === '#/security') return can(S.role, 'analytics') ? securityView() : shell('Security', h('p', null, 'Only admins can see the security numbers.'));
  if (hash === '#/tasks') return can(S.role, 'tasks') ? tasksView() : shell('Tasks', h('p', null, 'Only admins and editors can see the tasks.'));
  if (hash === '#/images') return can(S.role, 'settings') ? imagesView() : shell('Picture settings', h('p', null, 'Only admins can see the picture settings.'));
  if (hash === '#/links') return can(S.role, 'links') ? linksView() : shell('Links', h('p', null, 'Your role cannot edit the link list.'));
  if (hash === '#/export') return can(S.role, 'export') ? exportView() : shell('Export', h('p', null, 'Your role cannot export.'));
  if (hash === '#/settings') return can(S.role, 'settings') ? settingsView() : shell('Settings', h('p', null, 'Only admins can change settings.'));
  if (hash === '#/setup') return setupView();
  postsView();
}

// ---------- analytics (v0.37.0) ----------
let anTimer = null;
function stopAnalytics() { if (anTimer) { clearInterval(anTimer); anTimer = null; } }

async function analyticsView() {
  shell('Analytics', h('p', { class: 'mute' }, 'Loading…'));
  let endpoint = '';
  try { endpoint = readEndpoint((await S.gh.getText(P().analytics)).text); } catch { /* no file yet */ }
  const url = statsUrl(endpoint);
  if (!url) {
    return shell('Analytics', h('div', { class: 'card' }, h('h2', null, 'Analytics is not switched on'),
      h('p', null, 'Deploy the analytics Worker (steps in the README, "Analytics, part 2" to "part 5"), then put its address in config/analytics.json, for example:'),
      h('pre', null, '{ "endpoint": "https://news-analytics.yourname.workers.dev/collect" }'),
      h('p', { class: 'mute' }, 'Until then no visit is collected and this screen stays empty. Nothing is shown that was not measured.')));
  }
  let range = '24h', zone = tz();
  const out = h('div', { 'data-an': 'out' });
  const note = h('p', { class: 'mute', 'data-an': 'note' }, '');
  const btns = AN_RANGES.map(([id, label]) => h('button', { type: 'button', 'data-range': id, 'aria-pressed': String(id === range), onclick: () => { range = id; mark(); load(); schedule(); } }, label));
  const mark = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.range === range)));
  const zoneSel = h('select', { id: 'an-zone', 'aria-label': 'Time zone', onchange: (e) => { zone = e.target.value; if (last) draw(); } }, zoneList(zone).map((z) => h('option', { value: z, selected: z === zone }, z)));
  let last = null;
  const draw = () => { out.replaceChildren(renderStats(h, last, zone)); };
  async function load() {
    note.textContent = 'Loading…';
    try {
      const res = await fetch(`${url}?range=${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${S.gh.token}` }, cache: 'no-store' });
      if (!res.ok) { last = null; out.replaceChildren(); note.textContent = statsError(res.status); return; }
      last = await res.json();
      draw();
      note.textContent = 'Updated ' + new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeStyle: 'medium' }).format(new Date()) + ' (' + zone + ')';
    } catch { last = null; out.replaceChildren(); note.textContent = 'Could not reach the analytics Worker. Check the address in config/analytics.json and your connection.'; }
  }
  // Live view refreshes every 15 seconds, the others every 60 seconds (free-plan limits). Stops when you leave the screen.
  function schedule() { stopAnalytics(); anTimer = setInterval(() => { if (location.hash === '#/analytics' && document.visibilityState !== 'hidden') load(); }, range === '5m' ? 15000 : 60000); }
  shell('Analytics', h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'an-range' }, btns), h('div', { style: 'min-width:220px' }, zoneSel), h('button', { type: 'button', onclick: load }, 'Refresh')), note), out);
  load();
  schedule();
}

// ---------- security (v0.93.0, BOT_PROTECTION Part 8b-2) ----------
// The numbers come from the same analytics Worker and the same sign-in token as the Analytics screen (two calls: 24 hours and 7 days).
// The "last done" times of the two lists stay in this browser only (localStorage, one key, always inside try/catch). The rules and the drawing are in security.js.
async function securityView() {
  shell('Security', h('p', { class: 'mute' }, 'Loading…'));
  let endpoint = '';
  try { endpoint = readEndpoint((await S.gh.getText(P().analytics)).text); } catch { /* no file yet */ }
  const url = statsUrl(endpoint);
  let done = {};
  try { done = readLastDone(localStorage.getItem(LAST_DONE_KEY)); } catch { done = {}; }
  let summary = null;
  let notice = url ? 'Loading the numbers…' : 'Analytics is not switched on, so there are no numbers to judge yet. Put the Worker address in config/analytics.json (see the Analytics screen). The lists below still work.';
  const out = h('div', { 'data-sec': 'out' });
  const when = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: tz(), dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
  const draw = () => out.replaceChildren(renderSecurity(h, {
    summary, notice, lists: reviewLists(done, Date.now()), when,
    onDone: (id) => {
      done = markDone(done, id, Date.now());
      try { localStorage.setItem(LAST_DONE_KEY, writeLastDone(done)); } catch { /* the time stays on screen until the page is left */ }
      draw();
    },
  }));
  async function load() {
    if (!url) { draw(); return; }
    notice = 'Loading the numbers…'; summary = null; draw();
    try {
      const get = async (range) => {
        const res = await fetch(`${url}?range=${range}`, { headers: { Authorization: `Bearer ${S.gh.token}` }, cache: 'no-store' });
        if (!res.ok) { const e = new Error('stats'); e.status = res.status; throw e; }
        const j = await res.json();
        return { views: j.views, verifiedViews: j.verifiedViews };
      };
      const [a, b] = await Promise.all([get('24h'), get('7d')]);
      summary = securitySummary(a, b);
    } catch (e) {
      summary = null;
      notice = e && e.status ? statsError(e.status) : 'Could not reach the analytics Worker. Check the address in config/analytics.json and your connection.';
    }
    draw();
  }
  shell('Security', h('div', { class: 'card' }, h('div', { class: 'row' }, h('button', { type: 'button', 'data-sec': 'refresh', onclick: load }, 'Refresh'))), out);
  load();
}

// ---------- posts index ----------
async function loadPosts(force, onProgress) {
  if (S.posts && !force) return S.posts;
  if (force) S.tree = await S.gh.tree();
  const files = S.tree.filter((t) => t.path.startsWith(P().posts + '/') && t.path.endsWith('.md'));
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < files.length) {
      const f = files[i++];
      let text = cache.get('blob.' + f.sha);
      if (text === null) { text = await S.gh.blobText(f.sha); cache.set('blob.' + f.sha, text); }
      const { data, body } = parse(text);
      out.push({ path: f.path, sha: f.sha, data, body });
      if (onProgress) onProgress(out.length, files.length);
    }
  }));
  S.posts = out.sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  return S.posts;
}

async function loadAuthors() {
  const files = S.tree.filter((t) => t.path.startsWith(P().authors + '/') && t.path.endsWith('.json'));
  S.authors = await Promise.all(files.map(async (f) => ({ slug: f.path.split('/').pop().replace(/\.json$/, ''), path: f.path, sha: f.sha, ...JSON.parse(await S.gh.blobText(f.sha)) })));
  return S.authors;
}

function postsView() {
  const list = h('div', { class: 'list' }, h('p', { class: 'mute' }, 'Loading posts…'));
  const search = h('input', { type: 'search', placeholder: 'Search title or category' });
  const sel = h('select', null, ['all', 'draft', 'scheduled', 'published', 'archived'].map((s) => h('option', { value: s }, s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1))));
  shell('Posts', h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/post/new', style: 'text-decoration:none' }, 'New post'), h('div', { style: 'flex:1;min-width:200px' }, search), h('div', null, sel), h('button', { onclick: () => { S.posts = null; postsView(); } }, 'Refresh')), h('div', { class: 'card', style: 'margin-top:1rem' }, list));
  const draw = (posts) => {
    const q = search.value.toLowerCase();
    const rows = posts.filter((p) => (sel.value === 'all' || statusOf(p.data) === sel.value) && (`${p.data.title} ${p.data.category}`).toLowerCase().includes(q));
    list.replaceChildren(...(rows.length ? rows.map((p) => h('a', { class: 'item', href: '#/post/' + encodeURIComponent(p.path) },
      h('strong', null, p.data.title || '(no title)'), ' ', h('span', { class: 'badge ' + statusOf(p.data) }, statusOf(p.data)),
      h('div', { class: 'mute' }, `${p.data.category || '-'} · ${p.data.author || '-'} · ${p.data.date ? fmt(p.data.date) : 'no date'}`))) : [h('p', { class: 'mute' }, posts.length ? 'No posts match.' : 'No posts yet. Write the first one.')]));
  };
  loadPosts(false, (n, t) => { list.firstChild.textContent = `Loading posts… ${n}/${t}`; }).then((posts) => { draw(posts); search.oninput = () => draw(posts); sel.onchange = () => draw(posts); }).catch((e) => toast(e.message, true));
}

// ---------- editor ----------
const BLANK = () => ({ title: '', permalink: '', category: '', tags: [], date: '', author: S.site.defaultAuthor || 'shivam-das', description: '', metaTitle: '', focusKeyword: '', image: '', imageAlt: '', imageCredit: '', keyPoints: [], canonical: '', ogTitle: '', ogDescription: '', ogImage: '', robots: 'index,follow', location: [], schemaType: 'NewsArticle', breaking: false, featured: false, trending: false, autoLinks: true, ads: { hideAll: false, hidePopunder: false }, redirects: [], status: 'draft' });

async function imageInfo(src) {
  if (!src) return null;
  if (S.sizes.has(src)) return S.sizes.get(src);
  let info = null;
  if (/^https?:\/\//i.test(src)) info = await sizeOf(src);
  else {
    const file = S.tree.find((t) => t.path === joinPath(P().pub, src.split(/[?#]/)[0]));
    try {
      if (S.previews.has(src)) info = await sizeOf(S.previews.get(src));
      else if (file && !/\.svg$/i.test(file.path)) { const bmp = await createImageBitmap(new Blob([await S.gh.blobBytes(file.sha)])); info = { width: bmp.width, height: bmp.height }; }
    } catch { info = null; }
  }
  S.sizes.set(src, info);
  return info;
}

async function editorView(path) {
  shell(path ? 'Edit post' : 'New post', h('p', { class: 'mute' }, 'Loading…'));
  let posts;
  try { posts = await loadPosts(false); await loadAuthors(); } catch (e) { return toast(e.message, true); }
  const existing = path ? posts.find((p) => p.path === path) : null;
  if (path && !existing) return shell('Edit post', h('p', null, 'Post not found. It may have been moved. ', h('a', { href: '#/' }, 'Back to posts')));
  const base = { ...BLANK(), ...(existing ? existing.data : {}) };
  base.ads = { hideAll: false, hidePopunder: false, ...(existing && existing.data.ads ? existing.data.ads : {}) };
  let orig = existing ? { category: base.category, permalink: base.permalink, date: base.date, status: base.status, robots: base.robots, canonical: base.canonical, path, sha: existing.sha } : null;
  const d = base;
  let body = existing ? existing.body : '';
  const taken = () => new Set(posts.filter((p) => p.path !== path).map((p) => p.data.permalink));
  let permTouched = !!existing;
  const wasLive = !!orig && orig.status === 'published';
  let dateUnlocked = !wasLive;
  const readOnly = wasLive && !can(S.role, 'post:publish');
  const draftKey = 'adm.draft.' + (path || 'new');

  // restore autosave
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (saved && saved.body !== undefined && JSON.stringify(saved.d) !== JSON.stringify(d) && confirm('Restore your unsaved changes from this device?')) { Object.assign(d, saved.d); body = saved.body; permTouched = true; }
  } catch { /* ignore */ }

  const el = {};
  const val = (k, v) => (el[k] = v);
  const bindText = (k, attrs = {}, tag = 'input') => val(k, h(tag, { value: d[k] ?? '', oninput: (e) => { d[k] = e.target.value; changed(k); }, ...attrs, disabled: readOnly }));
  const bindBool = (k, label, sub) => h('label', { class: 'pill' }, h('input', { type: 'checkbox', checked: sub ? d[sub][k] : d[k], disabled: readOnly, onchange: (e) => { if (sub) d[sub][k] = e.target.checked; else d[k] = e.target.checked; changed(k); } }), label);

  const cats = [...new Set([...posts.map((p) => p.data.category), ...Object.keys(S.cats)].filter(Boolean))].sort();
  const dl = h('datalist', { id: 'cats' }, cats.map((c) => h('option', { value: c })));
  const titleIn = bindText('title', { placeholder: 'Headline (this becomes the H1)', maxlength: 140 });
  const permIn = bindText('permalink', { placeholder: 'auto from title' });
  permIn.addEventListener('input', () => { permTouched = true; });
  const catIn = bindText('category', { list: 'cats', placeholder: 'technology' });
  const tagsIn = h('input', { value: d.tags.join(', '), disabled: readOnly, oninput: (e) => { d.tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); changed('tags'); } });
  const authorSel = h('select', { disabled: readOnly, onchange: (e) => { d.author = e.target.value; changed('author'); } }, S.authors.map((a) => h('option', { value: a.slug, selected: a.slug === d.author }, a.name || a.slug)));
  const descIn = bindText('description', { rows: 3, maxlength: 200 }, 'textarea');
  const metaIn = bindText('metaTitle', { placeholder: 'optional, overrides the title in search results' });
  const kwIn = bindText('focusKeyword', { placeholder: 'new phone launch' });
  const imgIn = bindText('image', { placeholder: '/media/2026/11/photo.webp' });
  const altIn = bindText('imageAlt', { placeholder: 'Describe the picture' });
  const creditIn = bindText('imageCredit', { placeholder: 'Photo: source' });
  const pointsIn = h('textarea', { rows: 3, disabled: readOnly, value: d.keyPoints.join('\n'), oninput: (e) => { d.keyPoints = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); changed('keyPoints'); } });
  const canonIn = bindText('canonical', { placeholder: 'leave empty for the default' });
  // v0.101.22 (PLAN 33.2, Phase 3b Part 5b): the share card fields. They live in the Advanced fold of the listing box.
  const ogTitleIn = bindText('ogTitle', { placeholder: 'empty means the page title', maxlength: 140 });
  const ogDescIn = bindText('ogDescription', { rows: 2, placeholder: 'empty means the meta description', maxlength: 400 }, 'textarea');
  const ogImgIn = bindText('ogImage', { placeholder: 'empty means the featured image' });
  // v0.96.0 (push part 7e-2): the Notifications box. `auto` is never written to the file (see cleanPush).
  const pushSel = h('select', { 'data-push': 'mode', disabled: readOnly, onchange: (e) => { if (e.target.value === 'auto') delete d.push; else d.push = e.target.value; changed('push'); } }, PUSH_CHOICES.map((c) => h('option', { value: c.value, selected: c.value === pushValue(d) }, c.label)));
  const pushTitleIn = bindText('pushTitle', { 'data-push': 'title', placeholder: 'optional, replaces the headline', maxlength: PUSH_TITLE_MAX });
  const pushBodyIn = bindText('pushBody', { 'data-push': 'body', rows: 2, placeholder: 'optional, replaces the description', maxlength: PUSH_BODY_MAX }, 'textarea');
  const pushTitleCount = h('span', { class: 'hint', 'data-push': 'title-count' });
  const pushBodyCount = h('span', { class: 'hint', 'data-push': 'body-count' });
  const pushHelp = h('span', { class: 'hint', 'data-push': 'help' });
  const pushNoteBox = h('p', { class: 'mute', 'data-push': 'note' });
  const pushBox = h('div', { class: 'card', 'data-push': 'preview' });
  const robotsSel = h('select', { disabled: readOnly || !can(S.role, 'post:noindex'), onchange: (e) => { d.robots = e.target.value; changed('robots'); } }, ['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow'].map((r) => h('option', { value: r, selected: r === d.robots }, r)));
  const schemaSel = h('select', { disabled: readOnly, onchange: (e) => { d.schemaType = e.target.value; changed('schemaType'); } }, ['NewsArticle', 'Article', 'BlogPosting'].map((r) => h('option', { value: r, selected: r === d.schemaType }, r)));
  const dateIn = h('input', { type: 'datetime-local', value: d.date ? utcToZoned(new Date(d.date), tz()) : '', disabled: !dateUnlocked || readOnly, onchange: (e) => { d.date = e.target.value ? zonedToUtc(e.target.value, tz()).toISOString().replace('.000Z', 'Z') : ''; changed('date'); } });
  const dateNote = h('span', { class: 'hint' });
  const bodyIn = h('textarea', { class: 'body', disabled: readOnly, value: body, oninput: (e) => { body = e.target.value; changed('body'); } });
  const previewBox = h('div', { class: 'preview', hidden: true });
  const seoBox = h('div');
  const previews = h('div', { class: 'grid' });
  const msgBox = h('div');
  const hostBox = h('div', { 'data-hosting': 'box' });
  let imgInfo = null;

  const toolBtn = (label, fn) => h('button', { type: 'button', disabled: readOnly, onclick: fn }, label);
  const wrap = (a, b = a, ph = 'text') => {
    const s = bodyIn.selectionStart, e = bodyIn.selectionEnd, sel = bodyIn.value.slice(s, e) || ph;
    bodyIn.setRangeText(a + sel + b, s, e, 'select'); body = bodyIn.value; changed('body'); bodyIn.focus();
  };
  const line = (prefix) => { const s = bodyIn.selectionStart; const st = bodyIn.value.lastIndexOf('\n', s - 1) + 1; bodyIn.setRangeText(prefix, st, st, 'end'); body = bodyIn.value; changed('body'); bodyIn.focus(); };
  const toolbar = h('div', { class: 'tool' }, toolBtn('H2', () => line('## ')), toolBtn('H3', () => line('### ')), toolBtn('B', () => wrap('**')), toolBtn('I', () => wrap('*')),
    toolBtn('Link', () => { const u = prompt('Link address (use /path for an internal link)'); if (u) wrap('[', `](${u})`, 'link text'); }),
    toolBtn('List', () => line('- ')), toolBtn('Quote', () => line('> ')),
    toolBtn('Image', () => pickMedia((m) => { const alt = prompt('Alt text for this image') || ''; wrap('', `![${alt}](${m})`, ''); })),
    h('button', { type: 'button', onclick: (e) => { const on = previewBox.hidden; previewBox.hidden = !on; bodyIn.hidden = on; e.target.textContent = on ? 'Edit' : 'Preview'; if (on) previewBox.innerHTML = renderMarkdown(body, (u) => S.previews.get(u) || u); } }, 'Preview'));

  const pickBtn = h('button', { type: 'button', disabled: readOnly, onclick: () => pickMedia((m) => { d.image = m; imgIn.value = m; changed('image'); }) }, 'Choose or upload');

  // v0.101.18 (PLAN 33, Phase 3b Part 2): the Search engine listing box wraps the three inputs above, so saving, autosave and the slug logic are unchanged.
  const listingUi = listingBox({
    d, getBody: () => body, inputs: { title: metaIn, description: descIn, handle: permIn, ogTitle: ogTitleIn, ogDescription: ogDescIn, ogImage: ogImgIn, canonical: canonIn, schemaType: schemaSel },
    canCanonical: can(S.role, 'post:canonical'), previewSrc: (u) => S.previews.get(u) || u,
    ctx: () => ({ siteName: S.site.siteName || '', origin: S.cfg.siteUrl || location.origin, timeZone: tz() }),
    others: () => posts.filter((p) => p.path !== path).map((p) => ({ id: p.path, permalink: p.data.permalink, category: p.data.category, date: p.data.date, status: p.data.status })),
    orig: orig && { status: orig.status, permalink: orig.permalink, category: orig.category, date: orig.date }, now: () => new Date(),
    selfId: path, readOnly, startOpen: !existing, handleIsAuto: () => !permTouched,
    // v0.101.20 (PLAN 33.2, Phase 3b Part 4): the Hide from search switch writes robots through hideFromSearch() and keeps the Robots list in step.
    canHide: can(S.role, 'post:noindex'),
    onHide: (on) => { d.robots = hideFromSearch(d, on).robots; robotsSel.value = d.robots; changed('robots'); },
    onReset: (key) => {
      if (key === 'ogTitle') { d.ogTitle = ''; ogTitleIn.value = ''; changed('ogTitle'); }
      else if (key === 'ogDescription') { d.ogDescription = ''; ogDescIn.value = ''; changed('ogDescription'); }
      else if (key === 'ogImage') { d.ogImage = ''; ogImgIn.value = ''; changed('ogImage'); }
      else if (key === 'title') { d.metaTitle = ''; metaIn.value = ''; changed('metaTitle'); }
      else if (key === 'description') { d.description = ''; descIn.value = ''; changed('description'); }
      else { permTouched = false; d.permalink = uniqueSlug(slugify(d.title), taken()); permIn.value = d.permalink; changed('permalink'); }
    },
  });

  function renderPanels() {
    const r = analyze({ ...d, body, imageWidth: imgInfo && imgInfo.width, imageHeight: imgInfo && imgInfo.height });
    const cls = r.score >= 80 ? 'good' : r.score >= 50 ? 'warn' : 'bad';
    seoBox.replaceChildren(h('div', { class: 'score' }, h('div', { class: 'ring ' + cls }, String(r.score)), h('div', null, h('strong', null, 'SEO score'), h('div', { class: 'mute' }, `${r.words} words`))),
      h('ul', { class: 'checks' }, r.checks.map((c) => h('li', { class: c.status, title: c.hint }, c.label))));
    const base = (S.cfg.siteUrl || location.origin);
    const imgSrc = d.image ? S.previews.get(d.image) || d.image : '';
    previews.replaceChildren(
      h('div', { class: 'card' }, h('h2', null, 'Discover'), h('div', { class: 'disc' }, imgSrc ? h('img', { src: imgSrc, alt: '' }) : h('img', { alt: '' }), h('div', null, h('b', null, d.title || 'Headline'), h('span', { class: 'mute' }, S.site.siteName || '')))),
      h('div', { class: 'card' }, h('h2', null, 'Social card'), h('div', { class: 'soc' }, imgSrc ? h('img', { src: imgSrc, alt: '' }) : h('img', { alt: '' }), h('div', null, h('span', { class: 'mute' }, new URL(base).host), h('b', null, d.metaTitle || d.title || 'Headline'), h('span', { class: 'mute' }, truncate(d.description || '', 110))))));
    listingUi.refresh();
    const pp = pushPreview(d);
    pushTitleCount.textContent = pushCount(d.pushTitle, PUSH_TITLE_MAX);
    pushBodyCount.textContent = pushCount(d.pushBody, PUSH_BODY_MAX);
    pushHelp.textContent = (PUSH_CHOICES.find((c) => c.value === pushValue(d)) || PUSH_CHOICES[0]).help;
    pushNoteBox.textContent = pushNote(d, d.status);
    pushBox.replaceChildren(h('h2', null, 'Notification preview'), h('div', { class: 'soc' }, h('div', null, h('b', { 'data-push': 'pv-title' }, pp.title), h('span', { class: 'mute', 'data-push': 'pv-body' }, pp.body || 'The description is used here.'), h('span', { class: 'mute' }, S.site.siteName || ''))));
    dateNote.textContent = d.date ? `URL date: ${postUrl('x', 'y', new Date(d.date), tz()).split('/').slice(1, 4).join('-')} (${tz()})` : 'Empty means "now" when you publish.';
  }

  const refreshImg = debounce(async () => { imgInfo = await imageInfo(d.image); renderPanels(); }, 400);
  const autosave = debounce(() => { try { localStorage.setItem(draftKey, JSON.stringify({ d, body })); } catch { /* ignore */ } }, 1200);
  const rp = debounce(renderPanels, 200);
  function changed(k) {
    dirty = true;
    if (k === 'title' && !permTouched) { d.permalink = uniqueSlug(slugify(d.title), taken()); permIn.value = d.permalink; }
    if (k === 'image') refreshImg();
    listingUi.refresh();
    rp(); autosave();
  }

  // v0.101.55 (PLAN 34.3, Phase 3c Part 3c-8c-2): pictures that sit on other websites are hosted here first, in ONE commit that also holds the post.
  // Off unless admin/config.json has `imagesUrl`. All decisions are made in hosting-hook.js; these few lines only put its answers on the screen.
  function showHosted(f) {
    if (typeof f.body === 'string') { body = f.body; bodyIn.value = f.body; }
    for (const [k, input] of [['image', imgIn], ['imageAlt', altIn], ['ogImage', ogImgIn]]) if (typeof f[k] === 'string') { d[k] = f[k]; input.value = f[k]; }
    refreshImg();
  }
  async function afterHostedSave(next, newPath, stay) {
    dirty = false;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    S.posts = null;
    S.tree = await S.gh.tree().catch(() => S.tree);
    const fresh = stay ? await freshOrig(S.gh, next, newPath) : null;
    if (fresh) { orig = fresh; return; }
    const target = '#/post/' + encodeURIComponent(newPath);
    if (location.hash === target) route(); else location.hash = target;
  }

  async function save(status) {
    const next = { ...cleanPush(d), status };
    if (!next.title.trim()) return toast('Write a title first.', true);
    if (!next.permalink) next.permalink = uniqueSlug(slugify(next.title), taken());
    if (status === 'published' && !next.date) next.date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    if (!next.date) next.date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    next.updated = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    if (status === 'published' && !can(S.role, 'post:publish')) return toast('Your role can save drafts only.', true);
    if (!can(S.role, 'post:canonical') && String(next.canonical || '') !== String(orig ? orig.canonical || '' : '')) return toast('Only editors and admins can change the canonical address.', true);
    if (!can(S.role, 'post:noindex') && next.robots !== (orig ? orig.robots : 'index,follow')) return toast('Only editors and admins can change what search engines may list.', true);
    const info = status === 'published' && next.image ? await imageInfo(next.image) : null;
    const noPosts = !posts.some((p) => p.data.status === 'published');
    const { errors, warnings } = validatePost(next, body, { takenPermalinks: taken(), imageWidth: info ? info.width : null, timeZoneBlocked: status === 'published' && noPosts && S.site.timeZoneConfirmed !== true });
    msgBox.replaceChildren(...(errors.length ? [h('div', { class: 'card errors' }, h('strong', null, 'Fix these first:'), h('ul', null, errors.map((e) => h('li', null, e))))] : []), ...(warnings.length ? [h('div', { class: 'card warnings' }, h('strong', null, 'Warnings (you can still save):'), h('ul', { class: 'warnings' }, warnings.map((w) => h('li', null, w))))] : []));
    if (errors.length) { msgBox.scrollIntoView({ block: 'center' }); return; }
    next.redirects = nextRedirects(orig, next, tz(), { keepOld: listingUi.keepRedirect() });
    const newPath = joinPath(P().posts, next.category, next.permalink + '.md');
    hostBox.replaceChildren();
    let inSave = true;
    const onSaved = (r) => {
      showHosted(r.fields);
      if (!inSave) afterHostedSave(next, newPath, r.open > 0).then(() => toast(r.message || 'Saved.')).catch((e) => toast(e.message, true));
    };
    const hosted = await runHostingSave({ cfg: S.cfg, gh: S.gh, next, body, orig, newPath, tree: S.tree, canEdit: !readOnly, mount: (list) => hostBox.replaceChildren(list), onSaved });
    inSave = false;
    if (hosted.action === 'stop') return toast(hosted.message, true);
    if (hosted.action === 'saved') {
      await afterHostedSave(next, newPath, hosted.open > 0);
      toast((hosted.message || 'Saved.') + (status === 'published' ? ' The site updates in about 2 minutes.' : ''));
      return hosted;
    }
    const text = stringify(next, body);
    const sameFile = orig && orig.path === newPath;
    const msg = `${status === 'published' ? (new Date(next.date) > new Date() ? 'schedule' : 'publish') : status === 'archived' ? 'archive' : 'draft'}: ${next.permalink}`;
    const res = await S.gh.put(newPath, text, `admin: ${msg}`, sameFile ? orig.sha : undefined);
    if (orig && !sameFile) {
      try {
        await S.gh.remove(orig.path, orig.sha, `admin: move ${orig.permalink} to ${next.category}/${next.permalink}`);
      } catch (e) {
        // v0.4.0: two files with one permalink would stop the whole site build (BUGS U2), so undo the new file.
        let undone = true;
        try { await S.gh.remove(newPath, res.content.sha, `admin: undo failed move of ${orig.permalink}`); } catch { undone = false; }
        S.tree = await S.gh.tree().catch(() => S.tree);
        throw new Error(undone
          ? `The move was cancelled because the old file could not be removed (${e.message}). Nothing changed. Try again.`
          : `The old file could not be removed and the new file could not be undone (${e.message}). Delete one of these files on GitHub now, or the site build will stop: ${orig.path} or ${newPath}`);
      }
    }
    dirty = false;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    S.posts = null;
    S.tree = await S.gh.tree();
    toast((status === 'published' ? 'Saved. The site updates in about 2 minutes.' : 'Saved.') + (hosted.message ? ' ' + hosted.message : ''));
    // v0.101.55: when every picture failed, the post was saved as it was and the list stays on the screen for Retry (orig gets the new file sha, so the next Save does not clash).
    const fresh = hosted.reason === 'nothing' && hostBox.hasChildNodes() ? await freshOrig(S.gh, next, newPath) : null;
    if (fresh) { orig = fresh; return res; }
    const target = '#/post/' + encodeURIComponent(newPath);
    if (location.hash === target) route(); else location.hash = target;
    return res;
  }

  const action = (label, status, cls = '') => h('button', { class: cls, type: 'button', onclick: (e) => busy(e.target, () => save(status)) }, label);
  const buttons = readOnly ? [h('p', { class: 'mute' }, 'Published posts can be changed by editors and admins only.')] : wasLive
    ? [action('Update post', 'published', 'primary'), can(S.role, 'post:publish') ? action('Move to draft', 'draft') : null, action('Archive', 'archived', 'danger')]
    : [action('Save draft', 'draft'), can(S.role, 'post:publish') ? action('Publish or schedule', 'published', 'primary') : null, orig ? action('Archive', 'archived', 'danger') : null];

  const unlock = wasLive && !readOnly ? h('button', { type: 'button', onclick: () => { if (confirm('Changing the date changes the post URL. The old URL is kept as a redirect. Continue?')) { dateUnlocked = true; dateIn.disabled = false; } } }, 'Unlock date') : null;
  const historyLink = existing && S.repo ? h('a', { href: `${S.repo.html_url}/commits/${S.cfg.branch}/${existing.path}`, target: '_blank', rel: 'noopener' }, 'Version history on GitHub') : null;

  // v0.101.37 (PLAN 33.4, Phase 3b Part 9): the File tab. Everyone sees the raw file; only admins can change and save it.
  const savedRaw = existing ? rawText(existing.data, existing.body) : rawText(cleanPush(d), body);
  const canRaw = can(S.role, RAW_ACTION) && !!existing && !readOnly;
  const rawIn = h('textarea', { class: 'rawfile', 'data-file': 'text', spellcheck: 'false', readonly: !canRaw, value: savedRaw, oninput: () => { rawBtn.disabled = rawUnchanged(savedRaw, rawIn.value); } });
  const rawMsg = h('div', { 'data-file': 'msg' });
  async function saveRaw() {
    const out = parseRaw(rawIn.value);
    const problems = [...out.errors];
    if (out.ok) problems.push(...rawGuard({ role: S.role, orig, next: out.data }));
    if (!problems.length && dirty) problems.push('The form has changes that are not saved. Save or discard them first, or they would be lost.');
    let warnings = [];
    if (!problems.length) {
      const info = out.data.status === 'published' && out.data.image ? await imageInfo(out.data.image) : null;
      const v = validatePost(out.data, out.body, { takenPermalinks: taken(), imageWidth: info ? info.width : null, timeZoneBlocked: false });
      problems.push(...v.errors); warnings = v.warnings;
    }
    rawMsg.replaceChildren(...(problems.length ? [h('div', { class: 'card errors' }, h('strong', null, 'Fix these first:'), h('ul', null, problems.map((e) => h('li', null, e))))] : []), ...(warnings.length ? [h('div', { class: 'card warnings' }, h('strong', null, 'Warnings (saved anyway):'), h('ul', { class: 'warnings' }, warnings.map((w) => h('li', null, w))))] : []));
    if (problems.length) return;
    await S.gh.put(orig.path, stringify(out.data, out.body), `admin: edit file: ${orig.permalink}`, orig.sha);
    dirty = false;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    S.posts = null;
    S.tree = await S.gh.tree();
    toast('Saved the file. The site updates in about 2 minutes.');
    route();
  }
  const rawBtn = h('button', { class: 'primary', type: 'button', 'data-file': 'save', disabled: true, onclick: (e) => busy(e.target, saveRaw) }, 'Save file');
  const fileView = h('div', { hidden: true, 'data-tab-panel': 'file' }, h('div', { class: 'card' }, h('h2', null, 'File'),
    h('p', { class: 'mute' }, !existing ? 'Save the post from the form first. Then its file shows here.' : canRaw ? 'This is the whole Markdown file. The same checks as the form run when you save. The handle, category and date are changed in the form.' : 'This is the whole Markdown file. It is read-only for your role.'),
    rawIn, rawMsg, canRaw ? h('div', { class: 'row', style: 'margin-top:.8rem' }, rawBtn) : null));
  const formView = h('div', { 'data-tab-panel': 'form' });
  const tabBtn = (name, label) => h('button', { type: 'button', 'data-tab': name, 'aria-pressed': name === 'form' ? 'true' : 'false', onclick: () => { for (const b of tabs.children) b.setAttribute('aria-pressed', b.dataset.tab === name ? 'true' : 'false'); formView.hidden = name !== 'form'; fileView.hidden = name !== 'file'; } }, label);
  const tabs = h('div', { class: 'edtabs' }, tabBtn('form', 'Form'), tabBtn('file', 'File'));
  formView.append(dl, h('div', { class: 'grid editor' },
    h('div', null,
      h('div', { class: 'card' }, field('Title', titleIn), field('Body (Markdown)', h('div', null, toolbar, bodyIn, previewBox), 'No H1 in the body. Start with ## headings.')),
      h('div', { class: 'card' }, h('h2', null, 'Search and sharing'),
        listingUi.el, field('Focus keyword', kwIn)),
      h('div', { class: 'card' }, h('h2', null, 'Image'),
        field('Featured image path', h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:200px' }, imgIn), pickBtn), `at least ${MIN_IMAGE_WIDTH} px wide, 16:9 is best`), field('Alt text', altIn), field('Credit', creditIn)),
      h('div', { class: 'card' }, h('h2', null, 'Details'),
        h('div', { class: 'grid cols2' }, field('Category', catIn), field('Author', authorSel)), field('Tags', tagsIn, 'separate with commas'), field('Key points', pointsIn, 'one per line'),
        field('Publish date and time', h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:200px' }, dateIn), unlock), ''), dateNote,
        field('Robots', robotsSel),
        h('div', { style: 'margin-top:.8rem' }, bindBool('breaking', 'Breaking'), bindBool('featured', 'Featured'), bindBool('trending', 'Trending'), bindBool('autoLinks', 'Auto internal links'), bindBool('hideAll', 'Hide all ads', 'ads'), bindBool('hidePopunder', 'Hide popunder', 'ads'))),
      h('div', { class: 'card', 'data-push': 'box' }, h('h2', null, 'Notifications'),
        field('Notify readers', pushSel, ''), pushHelp, pushNoteBox,
        field('Notification title', h('div', null, pushTitleIn, pushTitleCount), 'empty means the headline'),
        field('Notification text', h('div', null, pushBodyIn, pushBodyCount), 'empty means the description')),
      msgBox, hostBox, h('div', { class: 'row card' }, ...buttons, historyLink)),
    h('aside', null, h('div', { class: 'card' }, seoBox), previews, pushBox)));
  shell(path ? 'Edit post' : 'New post', tabs, formView, fileView);
  imgInfo = await imageInfo(d.image);
  renderPanels();
}

// ---------- media ----------
function mediaFiles() { const m = P().media + '/'; return S.tree.filter((t) => t.path.startsWith(m) && IMG_RE.test(t.path)); }
const siteSrc = (path) => '/' + path.slice(P().pub.length + 1);

function mediaPanel(onPick) {
  const grid = h('div', { class: 'mgrid' });
  const draw = () => {
    const files = mediaFiles().reverse();
    grid.replaceChildren(...(files.length ? files.map((f) => {
      const src = siteSrc(f.path);
      const img = h('img', { src: S.previews.get(src) || src, alt: '', loading: 'lazy' });
      const info = h('span', null, src.replace('/media/', ''));
      img.addEventListener('load', () => { S.sizes.set(src, { width: img.naturalWidth, height: img.naturalHeight }); info.textContent = `${src.replace('/media/', '')} · ${img.naturalWidth}px${img.naturalWidth < MIN_IMAGE_WIDTH ? ' (too small for a featured image)' : ''}`; });
      return h('button', { class: 'tile', type: 'button', onclick: () => (onPick ? onPick(src) : (navigator.clipboard && navigator.clipboard.writeText(src), toast('Path copied: ' + src))) }, img, info);
    }) : [h('p', { class: 'mute' }, 'No images yet. Upload the first one.')]));
  };
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: (e) => busy(e.target, async () => { await uploadFiles([...e.target.files]); draw(); e.target.value = ''; }) });
  draw();
  return h('div', null, h('div', { class: 'row' }, h('label', { style: 'margin:0' }, 'Upload images ', h('span', { class: 'hint' }, '(converted to WebP, max 2400 px wide)')), input), h('div', { style: 'margin-top:1rem' }, grid));
}

async function uploadFiles(files) {
  if (!can(S.role, 'media')) throw new Error('Your role cannot upload media.');
  const now = new Date();
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz(), year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz(), month: '2-digit' }).format(now);
  for (const f of files) {
    const img = await prepareImage(f);
    const taken = new Set(S.tree.map((t) => t.path));
    const stem = mediaName(f.name);
    let path = joinPath(P().media, y, m, `${stem}.${img.ext}`);
    for (let n = 2; taken.has(path); n++) path = joinPath(P().media, y, m, `${stem}-${n}.${img.ext}`);
    await S.gh.put(path, img.bytes, `admin: upload ${path.split('/').pop()}`);
    S.tree.push({ path, type: 'blob', sha: 'new-' + Date.now() });
    const src = siteSrc(path);
    if (img.blob) S.previews.set(src, URL.createObjectURL(img.blob));
    if (img.width) S.sizes.set(src, { width: img.width, height: img.height });
    toast(img.width && img.width < MIN_IMAGE_WIDTH ? `Uploaded ${src} (only ${img.width}px wide: fine for the body, too small for a featured image)` : `Uploaded ${src}`);
  }
}

function pickMedia(onPick) {
  const m = modal([h('div', { class: 'row' }, h('h2', { style: 'flex:1' }, 'Media library'), h('button', { onclick: () => m.close() }, 'Close')), mediaPanel((src) => { onPick(src); m.close(); })]);
}

function mediaView() { shell('Media library', h('div', { class: 'card' }, mediaPanel(null))); }

// ---------- bulk alt text (v0.101.30, PLAN 33.3, Phase 3b Part 8a) ----------
// A table of the pictures without alt text. Save writes config/media.json once, in one commit (the sha makes a second editor's save fail instead of overwriting it).
async function bulkAltView() {
  shell('Alt text for all files', h('p', { class: 'mute' }, 'Loading\u2026'));
  await loadPosts(false);
  let map = {}, sha;
  try { const f = await S.gh.getText(P().mediaMeta); const j = JSON.parse(f.text); map = j && typeof j === 'object' && !Array.isArray(j) ? j : {}; sha = f.sha; } catch { map = {}; }
  const files = mediaFiles().reverse().map((t) => ({ path: siteSrc(t.path), bytes: t.size }));
  const box = bulkAltScreen({
    files, map, canEdit: can(S.role, 'media'),
    previewSrc: (path) => S.previews.get(path) || path,
    onSave: async (rows) => {
      if (!can(S.role, 'media')) throw new Error('Your role cannot change file details.');
      const r = mergeAltBulk(map, rows); if (r.errors.length) throw new Error(r.errors[0].message);
      if (!r.changed.length) return map;
      const put = await S.gh.put(P().mediaMeta, JSON.stringify(r.map, null, 2) + '\n', `admin: alt text for ${r.changed.length} ${r.changed.length === 1 ? 'file' : 'files'}`, sha);
      sha = (put && put.content && put.content.sha) || sha;
      map = r.map; toast('Saved.');
      return r.map;
    },
  });
  shell('Alt text for all files', h('p', { class: 'mute' }, 'Write a short sentence that says what each picture shows. Only pictures without alt text are listed. ', h('a', { href: '#/files' }, 'Back to Files')), h('div', { class: 'card' }, box.el));
}

// Posts and pages as { file, text } for the "Used in" list (Part 7b), and (Part 8b) the author and config files that can name a picture too.
// config/media.json is left out on purpose: it holds the picture as a key, so it would always block the delete.
async function contentItems(posts) {
  const pageFiles = S.tree.filter((t) => t.path.startsWith(P().pages + '/') && t.path.endsWith('.md'));
  const pages = await Promise.all(pageFiles.map(async (f) => ({ file: f.path, text: await S.gh.blobText(f.sha) })));
  return [...posts.map((p) => ({ file: p.path, text: stringify(p.data, p.body || '') })), ...pages];
}
async function otherItems() {
  const cfg = joinPath(S.cfg.contentRoot, 'config') + '/';
  const list = S.tree.filter((t) => t.path.endsWith('.json') && t.path !== P().mediaMeta && (t.path.startsWith(P().authors + '/') || t.path.startsWith(cfg)));
  return Promise.all(list.map(async (f) => ({ file: f.path, text: await S.gh.blobText(f.sha) })));
}

// ---------- files (v0.101.28, PLAN 33.3, Phase 3b Part 7b) ----------
// Alt text, caption and credit of a picture, kept in config/media.json. The rules are in media-meta.js, the drawing in files-screen.js.
async function filesView() {
  shell('Files', h('p', { class: 'mute' }, 'Loading\u2026'));
  const posts = await loadPosts(false);
  let map = {}, sha;
  try { const f = await S.gh.getText(P().mediaMeta); const j = JSON.parse(f.text); map = j && typeof j === 'object' && !Array.isArray(j) ? j : {}; sha = f.sha; } catch { map = {}; }
  const items = await contentItems(posts);
  const deleteItems = [...items, ...await otherItems()];
  const files = mediaFiles().reverse().map((t) => ({ path: siteSrc(t.path), bytes: t.size }));
  const screenBox = filesScreen({
    files, map, items, deleteItems, sizes: S.sizes, canEdit: can(S.role, 'media'), canDelete: can(S.role, 'media:delete'), canReplace: can(S.role, 'media:replace'), canRename: can(S.role, 'media:rename'),
    previewSrc: (path) => S.previews.get(path) || path,
    // Part 8b (v0.101.31): delete. Everything is read again first (a post saved a minute ago counts), then the picture and its entry in config/media.json go in ONE commit.
    onDelete: async (path) => {
      if (!can(S.role, 'media:delete')) throw new Error('Your role cannot delete files.');
      S.posts = null; S.tree = await S.gh.tree();
      const fresh = await contentItems(await loadPosts(false));
      const chk = deleteCheck(path, [...fresh, ...await otherItems()]);
      if (!chk.ok) throw new Error(chk.usedBy.length ? `${chk.reason} (${chk.usedBy.slice(0, 5).join(', ')})` : chk.reason);
      // Part 4c-4b (v0.101.62): the smaller copies of the picture (name.480w.webp) go in the same commit, with their notes in config/media.json.
      const plan = planDelete(path, { sitePaths: mediaFiles().map((t) => siteSrc(t.path)), pub: P().pub });
      const out = [...plan.deletes];
      let next = map;
      try {
        const cur = await S.gh.getText(P().mediaMeta); const j = JSON.parse(cur.text);
        next = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
        const w = mapWithout(next, [path, ...plan.copies]);
        if (w.changed) { next = w.map; out.push({ path: P().mediaMeta, text: JSON.stringify(next, null, 2) + '\n' }); }
      } catch { /* no config/media.json yet: there is no entry to remove */ }
      const n = plan.copies.length;
      await S.gh.commitFiles(out, `admin: delete file ${path.split('/').pop()}${n ? ` and ${n} smaller ${n === 1 ? 'copy' : 'copies'}` : ''}`);
      S.tree = await S.gh.tree().catch(() => S.tree); S.previews.delete(path); S.sizes.delete(path);
      try { sha = (await S.gh.getText(P().mediaMeta)).sha; } catch { sha = undefined; } // the commit moved the file, so the next Save needs the new sha
      map = next; toast('Deleted.');
      return next;
    },
    // Part 8c (v0.101.32): replace. Same address, new bytes, ONE commit. The role and the file are checked again here, not only on the screen.
    onReplace: async (path, file) => {
      if (!can(S.role, 'media:replace')) throw new Error('Your role cannot replace files.');
      const chk = replaceCheck(path, file); if (!chk.ok) throw new Error(chk.errors[0]);
      S.tree = await S.gh.tree();
      const repoPath = P().pub + path;
      if (!S.tree.some((t) => t.path === repoPath)) throw new Error('That file is already gone. Refresh the page.');
      // Part 4c-4d (v0.101.64): the smaller copies (name.480w.webp) would still show the OLD picture, so they are deleted in the same commit, with the `variants` note.
      const plan = planReplace(path, file.bytes, { sitePaths: mediaFiles().map((t) => siteSrc(t.path)), pub: P().pub });
      const out = [...plan.entries];
      let next = null;
      if (plan.copies.length) {
        try {
          const cur = JSON.parse((await S.gh.getText(P().mediaMeta)).text);
          const w = mapWithoutVariants(cur, path);
          if (w.changed) { next = w.map; out.push({ path: P().mediaMeta, text: JSON.stringify(next, null, 2) + '\n' }); }
        } catch { /* no config/media.json yet: there is no note to remove */ }
      }
      const nc = plan.copies.length;
      await S.gh.commitFiles(out, `admin: replace file ${path.split('/').pop()}${nc ? ` and remove ${nc} old smaller ${nc === 1 ? 'copy' : 'copies'}` : ''}`);
      S.tree = await S.gh.tree().catch(() => S.tree); S.sizes.delete(path);
      if (next) { try { sha = (await S.gh.getText(P().mediaMeta)).sha; } catch { sha = undefined; } map = next; } // the commit moved config/media.json, so the next Save needs the new sha
      const mime = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' }[pictureKind(file.bytes)];
      S.previews.set(path, URL.createObjectURL(new Blob([file.bytes], { type: mime }))); // the live address shows the new picture after the next deploy; the preview shows it now
      toast('Replaced.');
      return { map: next, removed: plan.copies }; // the screen drops the removed copies from its own list
    },
    // Part 8d-3 (v0.101.35): rename. The role first, then everything is read again (a post saved a minute ago counts), the rules of file-rename.js build the plan,
    // and ONE commit moves the picture, writes the changed posts, pages, authors and config files, adds the 301 and moves the config/media.json entry.
    onRename: async (path, newName) => {
      if (!can(S.role, 'media:rename')) throw new Error('Your role cannot rename files.');
      S.posts = null; S.tree = await S.gh.tree();
      const posts = await loadPosts(false);
      const fresh = [...await contentItems(posts), ...await otherItems()];
      const repoPath = P().pub + path;
      const entry = S.tree.find((t) => t.path === repoPath);
      if (!entry) throw new Error('That file is already gone. Refresh the page.');
      let stored = [];
      try { const j = JSON.parse((await S.gh.getText(P().redirects)).text); stored = Array.isArray(j) ? j : []; } catch { stored = []; }
      let current = {};
      try { const j = JSON.parse((await S.gh.getText(P().mediaMeta)).text); current = j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { current = {}; }
      const existingRedirects = stored.length + posts.reduce((n, p) => n + (Array.isArray(p.data.redirects) ? p.data.redirects.length : 0), 0);
      const plan = planFileRename(path, newName, { items: fresh, map: current, redirects: stored, existingRedirects, taken: mediaFiles().map((t) => siteSrc(t.path)), paths: { pub: P().pub, mediaMeta: P().mediaMeta, redirects: P().redirects } });
      const bytes = await S.gh.blobBytes(entry.sha);
      const out = [{ path: plan.moves[0].to, bytes }, { path: plan.moves[0].from, delete: true }];
      // Part 4c-4c (v0.101.63): each smaller copy (name.480w.webp) moves in the same commit, so none is left behind.
      for (const m of plan.moves.slice(1)) {
        const ce = S.tree.find((t) => t.path === m.from);
        if (!ce) throw new Error('That file is already gone. Refresh the page.');
        out.push({ path: m.to, bytes: await S.gh.blobBytes(ce.sha) }, { path: m.from, delete: true });
      }
      out.push(...plan.files);
      const nc = plan.copies.length;
      try { await S.gh.commitFiles(out, `admin: rename file ${path.split('/').pop()} to ${plan.newPath.split('/').pop()}${nc ? ` and ${nc} smaller ${nc === 1 ? 'copy' : 'copies'}` : ''}`); } finally { S.posts = null; S.tree = await S.gh.tree().catch(() => S.tree); }
      const mime = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' }[pictureKind(bytes)];
      S.previews.delete(path); S.sizes.delete(path);
      if (mime) S.previews.set(plan.newPath, URL.createObjectURL(new Blob([bytes], { type: mime }))); // the new address is live after the next deploy; the preview shows the picture now
      try { sha = (await S.gh.getText(P().mediaMeta)).sha; } catch { sha = undefined; } // the commit may have moved config/media.json, so the next Save needs the new sha
      const mm = plan.files.find((f) => f.path === P().mediaMeta);
      toast('Renamed.');
      return { newPath: plan.newPath, map: mm ? JSON.parse(mm.text) : current, counts: plan.counts };
    },
    // Save checks the role and the limits again, then writes config/media.json in one commit (the sha makes a second editor's save fail instead of overwriting it).
    onSave: async (path, fields) => {
      if (!can(S.role, 'media')) throw new Error('Your role cannot change file details.');
      const bad = mediaErrors(fields); if (bad.length) throw new Error(bad[0]);
      const next = mergeMedia(map, path, fields);
      const r = await S.gh.put(P().mediaMeta, JSON.stringify(next, null, 2) + '\n', `admin: file details ${path.split('/').pop()}`, sha);
      sha = (r && r.content && r.content.sha) || sha;
      map = next; toast('Saved.');
      return next;
    },
  });
  shell('Files', h('p', { class: 'mute' }, 'Alt text, caption and credit of each picture. Open a file to see where it is used and what to improve. Upload new pictures in Media. ', h('a', { href: '#/files/alt' }, 'Write alt text for many files at once')), h('div', { class: 'card' }, screenBox.el));
}

// ---------- authors ----------
// v0.101.24 (PLAN 33.2, Phase 3b Part 6b): the Search engine listing box for a category or an author.
function entryListingBox({ get, base, readOnly }) {
  const inputs = { metaTitle: h('input', { value: get.metaTitle(), placeholder: 'Empty: the name and the site name' }), metaDescription: h('textarea', { rows: 3, value: get.metaDescription() }) };
  inputs.metaTitle.disabled = Boolean(readOnly); inputs.metaDescription.disabled = Boolean(readOnly);
  const box = entryBox({
    inputs, readOnly,
    getEntry: () => ({ title: get.title(), description: get.description(), metaTitle: inputs.metaTitle.value, metaDescription: inputs.metaDescription.value }),
    ctx: () => ({ siteName: S.site.siteName || '', origin: S.cfg.siteUrl || location.origin, path: base() }),
    onReset: (key) => { (key === 'title' ? inputs.metaTitle : inputs.metaDescription).value = ''; },
  });
  const again = () => box.refresh();
  inputs.metaTitle.addEventListener('input', again); inputs.metaDescription.addEventListener('input', again);
  return { box, inputs, again };
}

async function authorsView() {
  shell('Authors', h('p', { class: 'mute' }, 'Loading…'));
  await loadAuthors();
  const form = (a) => {
    const f = { slug: h('input', { value: a.slug || '', disabled: !!a.path, placeholder: 'jane-doe' }), name: h('input', { value: a.name || '' }), bio: h('textarea', { rows: 4, value: a.bio || '' }), photo: h('input', { value: a.photo || '', placeholder: '/media/…' }), links: h('textarea', { rows: 3, value: (a.links || []).map((l) => `${l.label} | ${l.url}`).join('\n') }) };
    const seo = entryListingBox({ get: { title: () => f.name.value, description: () => f.bio.value, metaTitle: () => a.metaTitle || '', metaDescription: () => a.metaDescription || '' }, base: () => `/author/${a.slug || slugify(f.slug.value)}/`, readOnly: !can(S.role, 'authors') });
    f.name.addEventListener('input', seo.again); f.bio.addEventListener('input', seo.again); f.slug.addEventListener('input', seo.again);
    return h('div', { class: 'card' }, h('h2', null, a.path ? a.name || a.slug : 'New author'), field('Slug', f.slug), field('Name', f.name), field('Bio', f.bio, 'real bios help Google News and Discover'), field('Photo path', f.photo), field('Links', f.links, 'one per line: Label | https://…'), seo.box.el,
      h('p', null, h('button', { class: 'primary', onclick: (e) => busy(e.target, async () => {
        const slug = a.slug || slugify(f.slug.value);
        if (!slug || !f.name.value.trim()) throw new Error('Slug and name are required.');
        const links = f.links.value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0] && x[1]).map(([label, url]) => ({ label, url }));
        // v0.101.23: keep fields this screen does not show (metaTitle, metaDescription).
        const { slug: _s, path: _p, sha: _h, ...stored } = a;
        const data = mergeEntry(stored, { name: f.name.value.trim(), bio: f.bio.value.trim(), photo: f.photo.value.trim(), metaTitle: seo.inputs.metaTitle.value.trim(), metaDescription: seo.inputs.metaDescription.value.trim() });
        data.links = links;
        const bad = entryErrors(data); if (bad.length) throw new Error(bad[0]);
        await S.gh.put(a.path || joinPath(P().authors, slug + '.json'), JSON.stringify(data, null, 2) + '\n', `admin: author ${slug}`, a.sha);
        S.tree = await S.gh.tree(); toast('Saved.'); authorsView();
      }) }, 'Save author')));
  };
  shell('Authors', ...(can(S.role, 'authors') ? [...S.authors.map(form), form({})] : [h('p', null, 'Your role cannot edit authors.')]));
}

// ---------- categories ----------
/** v0.16.0: the "Rename slug" row of one category. One commit moves every post, keeps the old addresses and redirects the old category page. */
function renameRow(slug, posts) {
  const input = h('input', { placeholder: 'new-slug' });
  const go = (e) => busy(e.target, async () => {
    const to = input.value.trim().toLowerCase();
    let manual = [];
    try { const j = JSON.parse((await S.gh.getText(P().redirects)).text); manual = Array.isArray(j) ? j : []; } catch { manual = []; }
    const existingRedirects = manual.length + posts.reduce((n, p) => n + (Array.isArray(p.data.redirects) ? p.data.redirects.length : 0), 0);
    const plan = planRename(posts, slug, to, { root: S.cfg.contentRoot, tz: tz(), cats: S.cats, manualRedirects: manual, existingRedirects, takenPaths: S.tree.map((t) => t.path) });
    const c = plan.counts;
    if (!confirm(`Rename "${slug}" to "${to}"? ${c.posts} post(s) move to the new address, ${c.live} live. ${c.redirects} redirect(s) are added. It is saved in one commit and goes live at the next deploy (about 2 minutes). Google needs time to learn the new addresses; avoid doing this during a core update.`)) return;
    try { await S.gh.commitFiles(plan.files, `admin: rename category ${slug} to ${to} (${c.posts} posts)`); } finally { S.posts = null; S.tree = await S.gh.tree().catch(() => S.tree); }
    await loadSite();
    toast(`Renamed. ${c.posts} post(s) moved, ${c.redirects} redirect(s) added.`);
    categoriesView();
  });
  return h('div', { class: 'row', style: 'margin-top:.5rem' }, h('div', { style: 'flex:1;min-width:200px' }, field('Rename slug', input, 'lowercase letters, numbers, hyphens')), h('button', { type: 'button', onclick: go }, 'Rename'));
}

async function categoriesView() {
  shell('Categories', h('p', { class: 'mute' }, 'Loading…'));
  const posts = await loadPosts(false);
  const counts = new Map();
  for (const p of posts) if (p.data.category) counts.set(p.data.category, (counts.get(p.data.category) || 0) + 1);
  const slugs = [...new Set([...counts.keys(), ...Object.keys(S.cats)])].sort();
  const inputs = {};
  const rows = slugs.map((s) => { const c = S.cats[s] || {}; inputs[s] = { name: h('input', { value: c.name || '', placeholder: s }), description: h('input', { value: c.description || '' }) };
    const seo = entryListingBox({ get: { title: () => inputs[s].name.value.trim() || s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), description: () => inputs[s].description.value, metaTitle: () => c.metaTitle || '', metaDescription: () => c.metaDescription || '' }, base: () => `/category/${s}/`, readOnly: !can(S.role, 'categories') });
    inputs[s].seo = seo.inputs; inputs[s].name.addEventListener('input', seo.again); inputs[s].description.addEventListener('input', seo.again);
    return h('div', { class: 'card' }, h('strong', null, s), h('span', { class: 'mute' }, ` · ${counts.get(s) || 0} posts`), h('div', { class: 'grid cols2' }, field('Display name', inputs[s].name), field('Description', inputs[s].description)), seo.box.el,
      counts.get(s) && can(S.role, 'redirects') ? renameRow(s, posts) : null); });
  shell('Categories', h('p', { class: 'mute' }, 'A category exists once a post uses it. The slug is part of every post address; "Rename slug" moves all its posts and adds a redirect from every old address. The display name above can be changed without any move.'), ...rows,
    can(S.role, 'categories') ? h('button', { class: 'primary', onclick: (e) => busy(e.target, async () => {
      const out = {};
      for (const s of slugs) {
        const n = inputs[s].name.value.trim(), d = inputs[s].description.value.trim();
        // v0.101.23: keep fields this screen does not show (metaTitle, metaDescription).
        const e = mergeEntry(S.cats[s], { name: n, description: d, metaTitle: inputs[s].seo.metaTitle.value.trim(), metaDescription: inputs[s].seo.metaDescription.value.trim() });
        const bad = entryErrors(e); if (bad.length) throw new Error(`${s}: ${bad[0]}`);
        if (Object.keys(e).length) out[s] = e;
      }
      const f = S.tree.find((t) => t.path === P().cats);
      await S.gh.put(P().cats, JSON.stringify(out, null, 2) + '\n', 'admin: categories', f && f.sha);
      S.tree = await S.gh.tree(); await loadSite(); toast('Saved.');
    }) }, 'Save categories') : null);
}

// ---------- redirects (v0.5.0) ----------
async function redirectsView() {
  shell('Redirects', h('p', { class: 'mute' }, 'Loading…'));
  const posts = await loadPosts(false);
  let list = [], sha;
  try { const f = await S.gh.getText(P().redirects); const j = JSON.parse(f.text); list = Array.isArray(j) ? j : []; sha = f.sha; } catch { list = []; }
  const livePosts = posts.filter((p) => p.data.status === 'published' && p.data.category && p.data.permalink && p.data.date);
  const urlOf = (p) => postUrl(p.data.category, p.data.permalink, new Date(p.data.date), tz());
  const live = new Set(livePosts.map(urlOf));
  const auto = livePosts.flatMap((p) => (Array.isArray(p.data.redirects) ? p.data.redirects : []).map((from) => ({ from, to: urlOf(p), source: 'post' })));
  const save = async (next, note) => {
    await S.gh.put(P().redirects, JSON.stringify(next, null, 2) + '\n', 'admin: redirects', sha);
    toast(note || 'Saved. The site updates in about 2 minutes.');
    return redirectsView();
  };
  const fromIn = h('input', { placeholder: '/old/address/' });
  const toIn = h('input', { placeholder: '/new/address/' });
  const fileIn = h('input', { type: 'file', accept: '.csv,text/csv,text/plain', onchange: (e) => busy(e.target, async () => {
    const rows = parseCsv(await e.target.files[0].text());
    const next = [...list];
    const bad = [];
    for (const [a, b] of rows) { try { next.push(cleanEntry(a, b, live, next)); } catch (err) { bad.push(err.message); } }
    if (!rows.length) throw new Error('No rows found. Use two columns: from,to');
    if (next.length === list.length) throw new Error(`Nothing imported. ${bad[0] || ''}`);
    await save(next, `Imported ${next.length - list.length} redirect(s)${bad.length ? `, skipped ${bad.length}: ${bad[0]}` : ''}.`);
  }) });
  const exportCsv = () => {
    const blob = new Blob([toCsv([...list.map((r) => ({ ...r, source: 'manual' })), ...auto])], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'redirects.csv' });
    document.body.append(a); a.click(); a.remove();
  };
  const row = (r, i) => h('div', { class: 'item row' }, h('span', { style: 'flex:1;min-width:220px' }, h('code', null, r.from), ' ', icon('arrow-right'), ' ', h('code', null, r.to)),
    i === undefined ? h('span', { class: 'mute' }, 'from a post') : h('button', { class: 'danger', onclick: (e) => busy(e.target, () => save(list.filter((_, k) => k !== i), 'Removed.')) }, 'Remove'));
  shell('Redirects',
    h('p', { class: 'mute' }, 'Old addresses that must lead to a new one with a permanent (301) redirect. Moving a post adds its old address by itself. Add others here, for example an old Blogger link.'),
    h('div', { class: 'card' }, h('h2', null, 'Add a redirect'), h('div', { class: 'grid cols2' }, field('Old address', fromIn), field('New address', toIn, 'a page on this site')),
      h('p', null, h('button', { class: 'primary', onclick: (e) => busy(e.target, () => save([...list, cleanEntry(fromIn.value, toIn.value, live, list)])) }, 'Add redirect'))),
    h('div', { class: 'card' }, h('h2', null, `Added here (${list.length})`), ...(list.length ? list.map(row) : [h('p', { class: 'mute' }, 'None yet.')])),
    h('div', { class: 'card' }, h('h2', null, `From moved posts (${auto.length})`), ...(auto.length ? auto.map((r) => row(r)) : [h('p', { class: 'mute' }, 'None yet. They appear when a live post changes its address.')])),
    h('div', { class: 'card' }, h('h2', null, 'CSV'), h('div', { class: 'row' }, h('button', { onclick: exportCsv }, 'Export all as CSV'), h('div', { style: 'flex:1;min-width:200px' }, field('Import CSV (two columns: from,to)', fileIn)))));
}

// ---------- import (v0.10.0 preview, v0.12.0 save, v0.13.0 images) ----------
/** Downloads one remote image in the browser and converts it like an upload (WebP, 2400 px cap). Needs the old host to allow it (CORS). */
async function fetchRemoteImage(url) {
  const res = await fetch(url, AbortSignal.timeout ? { signal: AbortSignal.timeout(20000) } : {});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const ext = (new URL(url).pathname.match(/\.([a-z0-9]+)$/i) || [])[1] || 'jpg';
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : '';
  if (!type) throw new Error('not an image');
  const img = await prepareImage(new File([blob], `image.${ext}`, { type }));
  return { bytes: img.bytes, ext: img.ext, width: img.width };
}
const imageFetcher = { fn: fetchRemoteImage };
/** Lets tests replace the downloader (jsdom has no canvas). */
export function setImageFetcher(fn) { imageFetcher.fn = fn || fetchRemoteImage; }

async function saveImport(plan, fallbackCategory, note = () => {}) {
  if (fallbackCategory && !SLUG_RE.test(fallbackCategory)) throw new Error('Category: lowercase letters, numbers and hyphens only.');
  const posts = await loadPosts(false);
  let manual = [];
  try { const j = JSON.parse((await S.gh.getText(P().redirects)).text); manual = Array.isArray(j) ? j : []; } catch { manual = []; }
  const existingRedirects = manual.length + posts.reduce((n, p) => n + (Array.isArray(p.data.redirects) ? p.data.redirects.length : 0), 0);
  const opts = () => ({ root: S.cfg.contentRoot, author: S.site.defaultAuthor || 'shivam-das', fallbackCategory, takenPaths: S.tree.map((t) => t.path), manualRedirects: manual, existingRedirects });
  const pre = buildImportFiles(plan, opts());
  if (!pre.files.length) throw new Error(pre.skipped[0] ? `Nothing to save. ${pre.skipped[0].reason}` : 'Nothing to save.');
  const urls = collectImages(plan.rows);
  const live = pre.saved.posts + pre.saved.pages - pre.saved.drafts;
  if (!confirm(`Save ${pre.saved.posts} post(s) and ${pre.saved.pages} page(s) now? ${urls.length ? `${urls.length} image(s) are downloaded and saved first. ` : ''}${live} will go live at the next deploy (about 2 minutes), ${pre.saved.drafts} stay drafts.${pre.skipped.length ? ` ${pre.skipped.length} will be skipped.` : ''}`)) return null;
  // v0.13.0: re-host the images first (BUGS I2), in commits of 100. A failed download keeps the old address.
  const images = { saved: 0, failed: [] };
  if (urls.length) {
    const taken = new Set(S.tree.map((t) => t.path));
    let before = 0;
    for (const part of chunks(urls)) {
      const r = await downloadAll(part, imageFetcher.fn, { root: S.cfg.contentRoot, taken, onProgress: (n) => note(`Downloading images ${before + n} of ${urls.length}…`) });
      images.failed.push(...r.failed);
      if (r.files.length) {
        note('Saving images…');
        try { await S.gh.commitFiles(r.files, `admin: import ${r.files.length} image(s)`); } catch (e) { S.tree = await S.gh.tree().catch(() => S.tree); throw e; }
        images.saved += r.files.length;
        applyImages(plan.rows, r.map);
      }
      before += part.length;
    }
    S.tree = await S.gh.tree();
  }
  note('Saving posts and pages…');
  const res = buildImportFiles(plan, opts());
  if (!res.files.length) throw new Error('Nothing to save.');
  res.images = images;
  const groups = batches(res.files);

  let done = 0;
  try {
    for (const g of groups) { await S.gh.commitFiles(g, `admin: import ${g.length} file(s) (${done + 1}/${groups.length})`); done++; }
  } catch (e) {
    S.posts = null;
    S.tree = await S.gh.tree().catch(() => S.tree);
    throw new Error(done ? `${e.message} ${done} of ${groups.length} commit(s) were saved. Open Import again with the same file: saved items show as "Already on the site".` : e.message);
  }
  S.posts = null;
  S.tree = await S.gh.tree();
  return res;
}

async function importView() {
  shell('Import', h('p', { class: 'mute' }, 'Loading…'));
  const posts = await loadPosts(false);
  const out = h('div', null);
  const savePlan = (plan) => {
    const todo = plan.rows.filter((r) => !r.skip);
    const card = h('div', { class: 'card' }, h('h2', null, 'Save to the site'));
    if (!todo.length) { card.append(h('p', { class: 'mute' }, 'Nothing to save: every item is skipped.')); return card; }
    const needCat = todo.filter((r) => r.kind === 'post' && !r.category).length;
    const catIn = h('input', { placeholder: 'for example news' });
    const st = h('p', { class: 'mute', role: 'status' });
    const btn = h('button', { class: 'primary', type: 'button', onclick: (e) => busy(e.target, async () => {
      let res;
      try { res = await saveImport(plan, catIn.value.trim().toLowerCase(), (m) => { st.textContent = m; }); } finally { st.textContent = ''; }
      if (!res) return;
      const o = res.saved;
      toast(`Saved ${o.posts} post(s) and ${o.pages} page(s).`);
      card.replaceChildren(h('h2', null, 'Saved'),
        h('p', null, `${o.posts} post(s) and ${o.pages} page(s) saved, ${o.drafts} of them drafts. ${o.redirects} redirect(s) from old addresses.${o.noRedirect ? ` ${o.noRedirect} old address(es) got no redirect because Cloudflare allows 2000 redirects.` : ''}`),
        h('p', null, res.images.saved || res.images.failed.length ? `${res.images.saved} image(s) saved to the media library.${res.images.failed.length ? ` ${res.images.failed.length} could not be downloaded and keep the old address (${res.images.failed[0].reason}). Many old hosts block downloads from another site.` : ''}` : 'No images to download.'),
        h('p', { class: 'mute' }, 'Published items go live at the next deploy (about 2 minutes). Check one old address after the deploy: it must answer with a 301.'),
        ...(res.skipped.length ? [h('p', null, `${res.skipped.length} skipped:`), ...res.skipped.slice(0, 20).map((k) => h('div', { class: 'mute' }, `${k.title}: ${k.reason}`))] : []));
    }) }, `Save ${todo.length} item(s)`);
    card.append(
      h('p', { class: 'mute' }, 'Images are downloaded first and saved to the media library, then the posts and pages go in one commit. Items marked draft stay hidden until you publish them in Posts. Posts that already exist are never overwritten.'),
      needCat ? field(`Category for the ${needCat} post(s) that have none`, catIn, 'they are saved as drafts; leave empty to skip them') : null, btn, st);
    return card;
  };
  const fileIn = h('input', { type: 'file', accept: '.xml,text/xml,application/xml', onchange: (e) => busy(e.target, async () => {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = parseXml(await file.text());
    const existingPages = S.tree.filter((t) => t.path.startsWith(P().pages + '/') && t.path.endsWith('.md')).map((t) => t.path.split('/').pop().replace(/\.md$/, ''));
    const plan = planImport(parsed.items, { tz: tz(), existingPages, existing: posts.map((p) => ({ title: p.data.title, date: p.data.date, permalink: p.data.permalink, redirects: p.data.redirects })) });
    const c = plan.counts;
    const skipped = Object.entries(parsed.skipped).map(([k, n]) => `${n} ${k}`).join(', ');
    const shown = plan.rows.slice(0, 200);
    const line = (r) => h('div', { class: 'item row' },
      h('span', { style: 'flex:1;min-width:220px' }, h('strong', null, r.title || '(no title)'),
        h('div', { class: 'mute' }, r.skip ? `Skipped: ${r.skip}` : `${r.kind} · ${r.status}${r.category ? ' · ' + r.category : ''} · ${r.words} words${r.images.length ? ' · ' + r.images.length + ' image(s)' : ''}${r.newUrl ? ' · ' + r.newUrl : ''}`),
        ...r.issues.map((m) => h('div', { class: 'mute' }, icon('alert'), ' ' + m))));
    out.replaceChildren(
      h('div', { class: 'card' }, h('h2', null, `${parsed.format === 'blogger' ? 'Blogger' : 'WordPress'} file read`),
        h('p', null, `${c.posts} post(s), ${c.pages} page(s), ${c.drafts} of them drafts. ${c.duplicates} already on the site, ${c.noTitle} without a title. ${c.redirects} redirect(s) from old addresses. ${c.images} image(s) found.`),
        skipped ? h('p', { class: 'mute' }, `Not imported (not posts or pages): ${skipped}.`) : null,
        h('p', { class: 'mute' }, 'Nothing is written until you press Save below. The texts are already converted to clean Markdown.')),
      savePlan(plan),
      h('div', { class: 'card' }, h('h2', null, `Preview (${shown.length}${plan.rows.length > shown.length ? ' of ' + plan.rows.length : ''})`), ...shown.map(line)));
  }) });
  shell('Import',
    h('p', { class: 'mute' }, 'Choose a Blogger backup (Atom .xml) or a WordPress export (WXR .xml). You see what would be created before anything is saved. The first label becomes the category and the others become tags.'),
    h('div', { class: 'card' }, field('XML file', fileIn)), out);
}

// ---------- ads (v0.18.0) ----------
async function adsView() {
  shell('Ads', h('p', { class: 'mute' }, 'Loading…'));
  let cfg = { adsensePublisherId: '', extraLines: [] }, sha;
  try { const f = await S.gh.getText(P().ads); cfg = readAds(f.text); sha = f.sha; } catch { /* no file yet: start empty */ }
  const idIn = h('input', { value: cfg.adsensePublisherId, placeholder: 'ca-pub-1234567890123456', autocomplete: 'off' });
  const linesIn = h('textarea', { rows: 5, value: cfg.extraLines.join('\n'), placeholder: 'adnetwork.com, 12345, RESELLER' });
  const preview = h('pre', { class: 'mute', style: 'white-space:pre-wrap;word-break:break-all' });
  const note = h('p', { class: 'mute', role: 'status' });
  const refresh = () => {
    try { const t = adsTxt({ adsensePublisherId: idIn.value, extraLines: linesIn.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) }).text; preview.textContent = t || '(empty file)'; note.textContent = ''; }
    catch (e) { preview.textContent = ''; note.textContent = e.message; }
  };
  idIn.addEventListener('input', refresh); linesIn.addEventListener('input', refresh); refresh();
  shell('Ads',
    h('p', { class: 'mute' }, 'Builds /ads.txt. Nothing is shown to readers from this screen: ad scripts are switched on in the Ad loader screen, AdSense units come in a later part. Leave a field empty until you have the real value.'),
    h('div', { class: 'card' }, h('h2', null, 'Google AdSense'), field('Publisher id', idIn, 'from your AdSense account, after approval')),
    h('div', { class: 'card' }, h('h2', null, 'Other ad networks'), field('ads.txt lines', linesIn, 'one per line, exactly as the network gives them: domain, account id, DIRECT or RESELLER')),
    h('div', { class: 'card' }, h('h2', null, 'Your ads.txt'), preview, note),
    h('p', null, h('button', { class: 'primary', type: 'button', onclick: (e) => busy(e.target, async () => {
      const next = configFromForm(idIn.value, linesIn.value);
      await S.gh.put(P().ads, writeAds(next), 'admin: ads settings', sha);
      toast('Saved. /ads.txt updates in about 2 minutes.');
      return adsView();
    }) }, 'Save ads settings')));
}

// ---------- ad loader (v0.21.0) ----------
async function adLoaderView() {
  shell('Ad loader', h('p', { class: 'mute' }, 'Loading…'));
  let cfg = readLoader(''), sha;
  try { const f = await S.gh.getText(P().adLoader); cfg = readLoader(f.text); sha = f.sha; } catch { /* no file yet: start with the safe default */ }
  // v0.24.0: the AdSense unit needs the publisher id that the Ads screen keeps in config/ads.json.
  let pubId = '';
  try { pubId = readAds((await S.gh.getText(P().ads)).text).adsensePublisherId || ''; } catch { /* no id yet */ }
  let before = null;
  try { before = adLoaderPlan(cfg, pubId); } catch { /* a bad saved file counts as off */ }
  const comp = h('input', { type: 'checkbox', id: 'al-compliance', checked: cfg.complianceMode });
  const geoIn = h('input', { id: 'al-geo', value: cfg.geoUrl, placeholder: 'https://news-geo.yourname.workers.dev/geo', autocomplete: 'off' });
  const popIn = h('input', { id: 'al-pop', value: cfg.adsterra.popunder, placeholder: 'https://… (script address from Adsterra)', autocomplete: 'off' });
  const barIn = h('input', { id: 'al-bar', value: cfg.adsterra.socialBar, placeholder: 'https://… (script address from Adsterra)', autocomplete: 'off' });
  const smartIn = h('input', { id: 'al-smartlink', value: cfg.adsterra.smartlink, placeholder: 'https://… (Smartlink address from Adsterra)', autocomplete: 'off' });
  const natScriptIn = h('input', { id: 'al-native-script', value: cfg.adsterra.nativeBanner.script, placeholder: 'https://… (script address from Adsterra)', autocomplete: 'off' });
  const natIdIn = h('input', { id: 'al-native-id', value: cfg.adsterra.nativeBanner.containerId, placeholder: 'container-1a2b3c', autocomplete: 'off' });
  const natAfterIn = h('input', { id: 'al-native-after', type: 'number', min: '1', max: '20', value: String(cfg.adsterra.nativeBanner.afterParagraph), inputmode: 'numeric' });
  const asSlotIn = h('input', { id: 'al-adsense-slot', value: cfg.adsense.slot, placeholder: '1234567890', inputmode: 'numeric', autocomplete: 'off' });
  const asAfterIn = h('input', { id: 'al-adsense-after', type: 'number', min: '1', max: '20', value: String(cfg.adsense.afterParagraph), inputmode: 'numeric' });
  const daysIn = h('input', { id: 'al-consent-days', type: 'number', min: '30', max: '365', value: String(cfg.consentDays), inputmode: 'numeric' });
  const textIn = h('textarea', { id: 'al-consent-text', rows: '3', maxlength: '300', placeholder: 'empty = the built-in English sentence', value: cfg.consentText || '' });
  const accIn = h('input', { id: 'al-consent-accept', value: cfg.consentAccept || '', placeholder: 'Accept', maxlength: '24', autocomplete: 'off' });
  const decIn = h('input', { id: 'al-consent-decline', value: cfg.consentDecline || '', placeholder: 'No thanks', maxlength: '24', autocomplete: 'off' });
  const choIn = h('input', { id: 'al-consent-choices', value: cfg.consentChoices || '', placeholder: 'Ad choices', maxlength: '24', autocomplete: 'off' });
  const status = h('p', { role: 'status' });
  const note = h('p', { class: 'mute', role: 'status' });
  const values = () => ({ consentAccept: accIn.value, consentDecline: decIn.value, consentChoices: choIn.value, consentText: textIn.value, consentDays: daysIn.value, adsenseSlot: asSlotIn.value, adsenseAfter: asAfterIn.value, complianceMode: comp.checked, geoUrl: geoIn.value, popunder: popIn.value, socialBar: barIn.value, nativeScript: natScriptIn.value, nativeContainer: natIdIn.value, nativeAfter: natAfterIn.value, smartlink: smartIn.value });
  const refresh = () => {
    try { status.textContent = describePlan(loaderFromForm(values(), pubId), pubId); note.textContent = ''; }
    catch (e) { status.textContent = ''; note.textContent = e.message; }
  };
  [geoIn, popIn, barIn, smartIn, natScriptIn, natIdIn, natAfterIn, asSlotIn, asAfterIn, daysIn, textIn, accIn, decIn, choIn].forEach((i) => i.addEventListener('input', refresh));
  comp.addEventListener('change', refresh);
  refresh();
  shell('Ad loader',
    h('p', { class: 'mute' }, 'Decides if an ad script may be added to an article. Articles only: home, category, tag, author, search, static pages and 404 never get one. Leave everything empty and keep compliance mode on until you have real values and your AdSense and Google News approvals.'),
    h('div', { class: 'card' }, h('h2', null, 'Compliance mode'),
      h('label', null, comp, ' Compliance mode: no ad script on any page'),
      h('p', { class: 'mute' }, 'Keep it on while you apply to AdSense and Google News. Turning it off only matters when a script address is filled in below.')),
    h('div', { class: 'card' }, h('h2', null, 'Country check'), field('Geo Worker address', geoIn, 'the deployed workers/geo address, ending in /geo. Without it no ad script is allowed.')),
    h('div', { class: 'card' }, h('h2', null, 'Adsterra scripts'),
      field('Social bar script', barIn, 'copy exactly from your Adsterra account; empty = off'),
      field('Popunder script', popIn, 'copy exactly from your Adsterra account; empty = off')),
    h('div', { class: 'card' }, h('h2', null, 'Native banner'),
      h('p', { class: 'mute' }, 'One box inside the article text, with a fixed height and an "Advertisement" label. It is added only when the article has more paragraphs than the number below, and only when that place is still below the visible screen. Both the script address and the container id come from the Adsterra code. Empty = off.'),
      field('Native banner script', natScriptIn, 'the address in the Adsterra code (src=…)'),
      field('Container id', natIdIn, 'the id of the box in the Adsterra code, for example container-1a2b3c'),
      field('After paragraph number', natAfterIn, 'a whole number from 1 to 20; empty = 3')),
    h('div', { class: 'card' }, h('h2', null, 'Google AdSense unit'),
      h('p', { class: 'mute' }, 'One AdSense in-article box inside the article text, with a fixed height and an "Advertisement" label. It is added only when the article has more paragraphs than the number below, and only when that place is still below the visible screen. The AdSense id comes from the Ads screen' + (pubId ? ' (found: ca-' + pubId.replace(/^ca-/, '') + ').' : ' (none saved yet: fill it in there first).') + ' The slot number is the digits in data-ad-slot of your AdSense ad unit code. Use a different paragraph number than the native banner. Empty = off.'),
      field('AdSense slot number', asSlotIn, 'digits only, for example 1234567890'),
      field('After paragraph number', asAfterIn, 'a whole number from 1 to 20; empty = 5')),
    h('div', { class: 'card' }, h('h2', null, 'Smartlink'),
      h('p', { class: 'mute' }, 'Opens one time (once per session) in a new tab when the reader clicks a picture in the article. It is not a script and never redirects by itself. Empty = off.'),
      field('Smartlink address', smartIn, 'copy exactly from your Adsterra account')),
    h('div', { class: 'card' }, h('h2', null, 'Consent answer'),
      h('p', { class: 'mute' }, 'Readers from the EU, the EEA, the UK and Switzerland must click Accept before any ad loads. Their answer (Accept or No thanks) is kept in their browser for this many days, then the bar asks again.'),
      field('Days to keep the answer', daysIn, 'a whole number from 30 to 365; empty = 180'),
      field('Bar text', textIn, 'one line, 20 to 300 characters, no < or >; empty = built-in English sentence'),
      field('Accept button word', accIn, '2 to 24 characters; empty = Accept'),
      field('No thanks button word', decIn, '2 to 24 characters; empty = No thanks'),
      field('Ad choices button word', choIn, '2 to 24 characters; empty = Ad choices')),
    h('div', { class: 'card' }, h('h2', null, 'What this does'), status, note),
    h('p', null, h('button', { class: 'primary', type: 'button', onclick: (e) => busy(e.target, async () => {
      const next = loaderFromForm(values(), pubId);
      const plan = adLoaderPlan(next, pubId);
      if (plan && !before && !confirm('Turn ad scripts ON for article pages? Popunders and redirects can put AdSense and Google News approval at risk. Only continue if that is what you want. The change goes live at the next deploy (about 2 minutes).')) return;
      await S.gh.put(P().adLoader, writeLoader(next), 'admin: ad loader settings', sha);
      toast('Saved. The change goes live in about 2 minutes.');
      return adLoaderView();
    }) }, 'Save ad loader settings')));
}

// ---------- links (v0.15.0) ----------
// ---------- tasks (v0.101.13, read only) ----------
const TASK_FILE = /^tasks\/(open|done)\/T-\d{4}\.md$/;
async function tasksView() {
  shell('Tasks', h('p', { class: 'mute' }, 'Loading…'));
  const files = S.tree.filter((t) => TASK_FILE.test(t.path));
  const read = async (path) => { try { return (await S.gh.getText(path)).text; } catch { return ''; } };
  const cards = [];
  for (let i = 0; i < files.length; i += 5) {
    cards.push(...(await Promise.all(files.slice(i, i + 5).map(async (f) => readCard(await read(f.path), f.path)))));
  }
  const decisions = parseDecisions(await read('INCOMPLETE.md'));
  const copy = async (card) => {
    const text = aiPrompt(card);
    try { await navigator.clipboard.writeText(text); toast(`Prompt for ${card.id} copied.`); } catch {
      const box = h('textarea', { rows: '16', readonly: true, class: 'prompt-box' }, text); // clipboard blocked: show it to copy by hand
      modal(h('div', null, h('h2', null, `Prompt for ${card.id}`), box, h('p', { class: 'mute' }, 'Select all and copy.')));
      box.select();
    }
  };
  const needsLine = (c) => { const n = c.status === 'done' ? [] : unmetNeeds(c, cards, decisions); return n.length ? h('p', { class: 'warnline' }, 'Waiting for: ' + n.join('; ')) : null; };
  const cardBox = (c) => h('div', { class: 'tcard' },
    h('div', null, h('strong', null, c.id), ' ', h('span', { class: 'risk ' + c.risk }, c.risk || '?'), ' ', h('span', { class: 'mute' }, `${c.owner || '?'}${c.time ? ', ' + c.time : ''}`)),
    h('p', null, c.title),
    needsLine(c),
    c.risk === 'red' && !c.approvedBy && c.status !== 'done' ? h('p', { class: 'warnline' }, 'Red: no owner approval yet.') : null,
    c.problem ? h('p', { class: 'warnline' }, c.problem) : null,
    c.status !== 'done' ? h('button', { onclick: () => copy(c) }, 'Copy AI prompt') : null);
  const waiting = waitingForOwner(cards);
  const blocking = blockingDecisions(cards, decisions);
  const cols = taskBoard(cards);
  shell('Tasks',
    h('p', { class: 'mute' }, 'Read only. The cards are the files in tasks/ of the repository; to change one, edit the file or ask an AI with a prompt from here.'),
    h('div', { class: 'card' }, h('h2', null, `Waiting for the owner (${waiting.length})`),
      waiting.length ? waiting.map(cardBox) : h('p', { class: 'mute' }, 'Nothing waits for the owner.')),
    h('div', { class: 'card' }, h('h2', null, `Decisions that block work (${blocking.length})`),
      blocking.length ? h('ul', null, blocking.map((d) => h('li', null, `Decision ${d.num}: ${d.item}. Blocks ${d.behind.join(', ')}.`))) : h('p', { class: 'mute' }, 'No open decision blocks a task.')),
    h('h2', null, 'Board'),
    h('div', { class: 'board' }, COLUMNS.filter((k) => cols[k].length).map((k) => h('div', { class: 'col' }, h('h3', null, `${COLUMN_LABEL[k]} (${cols[k].length})`), cols[k].map(cardBox)))),
    cards.length ? null : h('p', { class: 'mute' }, 'No task cards found in tasks/open or tasks/done.'));
}

// ---------- picture settings (Phase 3c Parts 7s, 7v and 7ad: the screen, the form and the Save button) ----------
async function imagesView() {
  shell('Picture settings', h('p', { class: 'mute' }, 'Loading…'));
  let settings = null;
  let currentText; // the text of the file, so that the form keeps the keys it does not know
  let loaded = null; // what the file held when this page was opened: its text, or null when there was no file (the save stops if it is different later)
  let note = '';
  try {
    const got = await S.gh.getText(imagesPathOf(S.cfg));
    loaded = got.text;
    const parsed = JSON.parse(got.text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    settings = parsed;
    currentText = got.text;
  } catch {
    note = 'The file config/images.json could not be read (it is missing, or it is not a JSON object), so the shipped values are shown.';
  }
  if (location.hash !== '#/images') return; // the person went to another screen while the file was loading
  // Part 7ad (v0.101.99): the Save button under the form. It calls saveImagesSettings (images-save.js): one write of config/images.json, and only when the values are right.
  const saveBtn = h('button', { class: 'primary', 'data-f': 'images-save', disabled: true }, 'Save picture settings');
  const form = imagesFormScreen({ settings, currentText, onChange: (r) => { saveBtn.disabled = !r.ok; } });
  saveBtn.disabled = !form.read().ok;
  saveBtn.onclick = () => busy(saveBtn, async () => {
    const r = form.read();
    if (!r.ok) return;
    const res = await saveImagesSettings(S.gh, S.cfg, r.settings, { loadedText: loaded });
    if (!res.ok) { toast(res.message, true); return; }
    toast(res.changed ? 'Saved. The site updates in about 2 minutes.' : 'Nothing to save: the file already has these values.');
    if (res.changed) return imagesView();
  });
  shell('Picture settings', imagesScreen({ settings, note }).el, h('h2', null, 'Try a change'), form.el, h('p', { 'data-f': 'images-save-row' }, saveBtn));
}

async function linksView() {
  shell('Links', h('p', { class: 'mute' }, 'Loading…'));
  let list = [], sha;
  try { const f = await S.gh.getText(P().links); list = readLinks(f.text); sha = f.sha; } catch { list = []; }
  const save = async (next, note) => {
    await S.gh.put(P().links, writeLinks(next), 'admin: link list', sha);
    toast(note || 'Saved. The site updates in about 2 minutes.');
    return linksView();
  };
  const kIn = h('input', { placeholder: 'for example solar power' });
  const uIn = h('input', { placeholder: '/category/energy/' });
  const row = (r, i) => h('div', { class: 'item row' }, h('span', { style: 'flex:1;min-width:220px' }, h('strong', null, r.keyword), ' ', icon('arrow-right'), ' ', h('code', null, r.url)),
    h('button', { class: 'danger', onclick: (e) => busy(e.target, () => save(list.filter((_, k) => k !== i), 'Removed.')) }, 'Remove'));
  shell('Links',
    h('p', { class: 'mute' }, 'Your own keyword list for automatic internal links. The first time the keyword appears in an article, it becomes a link to the address you set here. Your list wins over links the site finds by itself. Only the first mention is linked, never inside headings.'),
    h('div', { class: 'card' }, h('h2', null, 'Add a keyword'), h('div', { class: 'grid cols2' }, field('Keyword', kIn, 'at least 4 characters, letters and numbers'), field('Address', uIn, 'a page on this site, starting with /')),
      h('p', null, h('button', { class: 'primary', onclick: (e) => busy(e.target, () => save([...list, cleanLink(kIn.value, uIn.value, list)])) }, 'Add keyword'))),
    h('div', { class: 'card' }, h('h2', null, `Your list (${list.length})`), ...(list.length ? list.map(row) : [h('p', { class: 'mute' }, 'Empty. The site still links by itself using post titles, focus keywords, tags and categories.')])));
}

// ---------- export (v0.14.0) ----------
/** Reads every Markdown file under a folder (posts or pages) with the same blob cache as the posts list. */
async function loadMarkdown(dir, onProgress) {
  const files = S.tree.filter((t) => t.path.startsWith(dir + '/') && t.path.endsWith('.md'));
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < files.length) {
      const f = files[i++];
      let text = cache.get('blob.' + f.sha);
      if (text === null) { text = await S.gh.blobText(f.sha); cache.set('blob.' + f.sha, text); }
      const { data, body } = parse(text);
      out.push({ path: f.path, data, body });
      if (onProgress) onProgress(out.length, files.length);
    }
  }));
  return out;
}

async function exportView() {
  shell('Export', h('p', { class: 'mute' }, 'Loading…'));
  await loadAuthors();
  const st = h('p', { class: 'mute', role: 'status' });
  const baseIn = h('input', { value: S.site.siteUrl || location.origin, placeholder: 'https://yourdomain.com' });
  const run = (e) => busy(e.target, async () => {
    const base = baseIn.value.trim().replace(/\/+$/, '');
    if (base && !/^https?:\/\/[^\s/]+$/i.test(base)) throw new Error('Site address: start with https:// and use only the domain, for example https://yourdomain.com');
    S.tree = await S.gh.tree();
    const note = (n, t) => { st.textContent = `Reading files ${n} of ${t}…`; };
    const posts = await loadMarkdown(P().posts, note);
    const pages = await loadMarkdown(P().pages, note);
    st.textContent = '';
    if (!posts.length && !pages.length) throw new Error('Nothing to export yet. Write a post first.');
    const authors = Object.fromEntries(S.authors.map((a) => [a.slug, a.name || a.slug]));
    const { xml, counts } = buildExport(posts, pages, { siteName: S.site.siteName, base, tz: tz(), authors });
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = h('a', { href: URL.createObjectURL(blob), download: exportName(S.site.siteName, new Date(), tz()) });
    document.body.append(a); a.click(); a.remove();
    toast(`Backup ready: ${counts.posts} post(s), ${counts.pages} page(s).`);
    st.textContent = `Downloaded ${counts.posts} post(s) and ${counts.pages} page(s), ${counts.drafts} of them drafts or archived (written as drafts).${counts.noAddress ? ` ${counts.noAddress} item(s) have no permalink, date or category, so they have no address in the file.` : ''}`;
  });
  shell('Export',
    h('p', { class: 'mute' }, 'Download all posts and pages as one XML backup (Blogger format). You can import the same file again on the Import screen. Drafts and archived posts are saved as drafts, so they never go public by accident. Images stay as links to this site; they are not inside the file.'),
    h('div', { class: 'card' }, field('Site address', baseIn, 'used for image links and old addresses inside the file'), h('p', null, h('button', { class: 'primary', type: 'button', onclick: run }, 'Download backup (.xml)')), st));
}

// ---------- settings ----------
async function settingsView() {
  shell('Settings', h('p', { class: 'mute' }, 'Loading…'));
  let robots = { blockedBots: [], extraDisallow: [], extraSitemaps: [] }, robotsSha;
  try { const r = await S.gh.getText(P().robots); robots = { ...robots, ...JSON.parse(r.text) }; robotsSha = r.sha; } catch { /* use defaults */ }
  const s = S.site;
  const zones = (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [s.timeZone || 'UTC']);
  const t = (k, ph) => h('input', { value: s[k] ?? '', placeholder: ph || '' });
  const n = (k) => h('input', { type: 'number', value: s[k] ?? '', min: 0 });
  const f = { homeTitle: t('homeTitle', 'Empty: site name - tagline'), siteName: t('siteName'), tagline: t('tagline'), description: h('textarea', { rows: 3, value: s.description || '' }), locale: t('locale', 'en_US'), defaultAuthor: t('defaultAuthor'), themeColor: t('themeColor', '#d94a00'), publisherEmail: t('publisherEmail'), publisherCountry: t('publisherCountry', 'IN'),
    activeCategoryDays: n('activeCategoryDays'), postsPerPage: n('postsPerPage'), thinTagMinPosts: n('thinTagMinPosts'), newsMaxAgeHours: n('newsMaxAgeHours'), feedItems: n('feedItems'),
    sameAs: h('textarea', { rows: 3, value: (s.sameAs || []).join('\n') }), google: h('input', { value: (s.verification || {}).google || '' }), bing: h('input', { value: (s.verification || {}).bing || '' }), yandex: h('input', { value: (s.verification || {}).yandex || '' }),
    tz: h('select', null, zones.map((z) => h('option', { value: z, selected: z === s.timeZone }, z))), tzOk: h('input', { type: 'checkbox', checked: s.timeZoneConfirmed === true }) };
  const bots = Object.fromEntries(AI_BOTS.map((b) => [b, h('input', { type: 'checkbox', checked: robots.blockedBots.includes(b) })]));
  const extraBots = robots.blockedBots.filter((b) => !AI_BOTS.includes(b));
  const dis = h('textarea', { rows: 3, value: robots.extraDisallow.join('\n') });
  const maps = h('textarea', { rows: 3, value: robots.extraSitemaps.join('\n') });
  const lines = (el) => el.value.split('\n').map((x) => x.trim()).filter(Boolean);
  const num = (el, k) => (el.value === '' ? s[k] : Number(el.value));
  // v0.101.25 (PLAN 33.2, Phase 3b Part 6c): the Search engine listing box of the home page. It holds the home title and the site description.
  const homeBox = entryBox({
    inputs: { metaTitle: f.homeTitle, metaDescription: f.description },
    getEntry: () => ({ title: f.siteName.value, description: '', metaTitle: f.homeTitle.value, metaDescription: f.description.value }),
    ctx: () => ({ siteName: f.siteName.value.trim(), origin: S.cfg.siteUrl || location.origin, path: '/', autoTitle: f.tagline.value.trim() ? `${f.siteName.value.trim()} - ${f.tagline.value.trim()}` : f.siteName.value.trim() }),
    onReset: (key) => { (key === 'title' ? f.homeTitle : f.description).value = ''; },
    hints: { title: 'Empty means the site name and the tagline. This is the whole title of the home page, as typed.', description: 'Used in search results and social cards of the home page and as the default of other pages.' },
  });
  for (const el of [f.homeTitle, f.description, f.siteName, f.tagline]) el.addEventListener('input', () => homeBox.refresh());
  shell('Settings',
    h('div', { class: 'card' }, h('h2', null, 'Site'), field('Site name', f.siteName), field('Tagline', f.tagline), field('Locale', f.locale), field('Default author slug', f.defaultAuthor), field('Theme colour', f.themeColor)),
    homeBox.el,
    h('div', { class: 'card' }, h('h2', null, 'Time zone'), field('Publisher time zone', f.tz, 'post URLs contain the date in this zone and are permanent'), h('label', { class: 'pill' }, f.tzOk, 'I confirm this time zone is correct')),
    h('div', { class: 'card' }, h('h2', null, 'Publisher (Google News)'), field('Email', f.publisherEmail), field('Country code', f.publisherCountry), field('Social profile links', f.sameAs, 'one URL per line')),
    h('div', { class: 'card' }, h('h2', null, 'Verification codes'), field('Google Search Console', f.google), field('Bing Webmaster', f.bing), field('Yandex', f.yandex)),
    h('div', { class: 'card' }, h('h2', null, 'Lists and feeds'), field('Days a category stays in the menu', f.activeCategoryDays), field('Posts per page', f.postsPerPage), field('Tag needs this many posts to be indexed', f.thinTagMinPosts), field('News sitemap window (hours)', f.newsMaxAgeHours), field('Feed items', f.feedItems)),
    h('button', { class: 'primary', onclick: (e) => busy(e.target, async () => {
      const next = { ...s, siteName: f.siteName.value.trim(), tagline: f.tagline.value.trim(), description: f.description.value.trim(), locale: f.locale.value.trim() || 'en_US', defaultAuthor: f.defaultAuthor.value.trim(), themeColor: f.themeColor.value.trim(), timeZone: f.tz.value, timeZoneConfirmed: f.tzOk.checked,
        publisherEmail: f.publisherEmail.value.trim(), publisherCountry: f.publisherCountry.value.trim(), sameAs: lines(f.sameAs), verification: { google: f.google.value.trim(), bing: f.bing.value.trim(), yandex: f.yandex.value.trim() },
        activeCategoryDays: num(f.activeCategoryDays, 'activeCategoryDays'), postsPerPage: num(f.postsPerPage, 'postsPerPage'), thinTagMinPosts: num(f.thinTagMinPosts, 'thinTagMinPosts'), newsMaxAgeHours: num(f.newsMaxAgeHours, 'newsMaxAgeHours'), feedItems: num(f.feedItems, 'feedItems') };
      if (!next.siteName) throw new Error('Site name is required.');
      const home = f.homeTitle.value.trim();
      if (home) next.homeTitle = home; else delete next.homeTitle;
      const bad = entryErrors({ metaTitle: next.homeTitle, metaDescription: next.description }); if (bad.length) throw new Error(`Home page: ${bad[0]}`);
      if (s.timeZone && next.timeZone !== s.timeZone && S.posts && S.posts.some((p) => p.data.status === 'published') && !confirm('Posts already exist. Changing the time zone can change the date in URLs. Continue?')) return;
      const r = await S.gh.put(P().site, JSON.stringify(next, null, 2) + '\n', 'admin: site settings', S.siteSha);
      S.site = next; S.siteSha = r.content.sha; toast('Settings saved.');
    }) }, 'Save settings'),
    h('div', { class: 'card', style: 'margin-top:1.5rem' }, h('h2', null, 'robots.txt'), h('p', { class: 'mute' }, 'Block AI crawlers that you do not want training on your stories. Search engines stay allowed.'),
      h('div', null, AI_BOTS.map((b) => h('label', { class: 'pill' }, bots[b], b))), field('Extra Disallow paths', dis, 'one per line, for example /private/'), field('Extra sitemap URLs', maps),
      h('p', null, h('button', { class: 'primary', onclick: (e) => busy(e.target, async () => {
        const out = { blockedBots: [...AI_BOTS.filter((b) => bots[b].checked), ...extraBots], extraDisallow: lines(dis), extraSitemaps: lines(maps) };
        const r = await S.gh.put(P().robots, JSON.stringify(out, null, 2) + '\n', 'admin: robots settings', robotsSha);
        robotsSha = r.content.sha; toast('Saved.');
      }) }, 'Save robots'))));
}

// ---------- setup checklist ----------
async function setupView() {
  shell('Setup', h('p', { class: 'mute' }, 'Checking…'));
  await loadAuthors();
  const posts = await loadPosts(false);
  const s = S.site;
  const rows = [
    ['Signed in with GitHub', true, `${S.user.login} (${S.role})`, null],
    ['Repository reachable', !!S.repo, S.cfg.repo, null],
    ['Can save to the repo', !!(S.repo.permissions && S.repo.permissions.push), S.repo.permissions && S.repo.permissions.push ? 'Write access' : 'This account is read-only', null],
    ['GitHub sign-in Worker connected', !!S.cfg.authUrl, S.cfg.authUrl ? 'authUrl set' : 'Optional: set authUrl in admin/config.json (see README)', null],
    ['Publisher time zone confirmed', s.timeZoneConfirmed === true, `Zone: ${s.timeZone || 'not set'}`, '#/settings'],
    ['Site description and tagline', !!(s.description && s.tagline), 'Needed for search results', '#/settings'],
    ['Publisher email and country', !!(s.publisherEmail && s.publisherCountry), 'Needed for Google News', '#/settings'],
    ['Author with a real bio', S.authors.some((a) => (a.bio || '').trim().length > 20), 'Bylines build trust (E-E-A-T)', '#/authors'],
    ['Logo and icons present', S.tree.some((t) => t.path === joinPath(P().pub, 'icon-512.png')), 'Made from brand/source-icon.png', null],
    ['At least one post', posts.length > 0, `${posts.length} post${posts.length === 1 ? '' : 's'}`, '#/post/new'],
  ];
  shell('Setup', h('div', { class: 'card' }, h('ul', { class: 'checks' }, rows.map(([label, ok, note, link]) => h('li', { class: ok ? 'good' : 'warn' }, h('strong', null, label), ' ', h('span', { class: 'mute' }, note), link && !ok ? h('span', null, ' ', h('a', { href: link }, 'Fix')) : null)))));
}
