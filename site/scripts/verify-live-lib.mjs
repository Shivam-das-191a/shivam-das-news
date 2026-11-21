// Phase 3k Part 4 (PLAN 43, LOGICS 31.11): the live check of a published address. No file access; fetch is passed in so tests can fake it.
// Each address must give: the expected status (200 or a redirect), one canonical equal to the address, no noindex (unless allowed),
// JSON-LD that parses, no http:// picture, script or style on an https page, and an answer in under 3 seconds.

export const MAX_MS = 3000;

/** "/path" or "/path@301" gives { path, status }. */
export function parseSpec(s) {
  const m = /^(.*?)(?:@(\d{3}))?$/.exec(String(s).trim());
  return { path: m[1], status: m[2] ? Number(m[2]) : 200 };
}

const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null; };

/** What a page says about itself: { canonicals, robots, jsonld: [{ ok, error }], mixed }. */
export function analyseHtml(html, isHttps = true) {
  const text = String(html ?? '');
  const canonicals = [], robots = [], mixed = [];
  for (const tag of text.match(/<link\b[^>]*>/gi) || []) {
    const rel = (attr(tag, 'rel') || '').toLowerCase().split(/\s+/);
    const href = attr(tag, 'href');
    if (rel.includes('canonical') && href !== null) canonicals.push(href);
    else if (isHttps && href && /^http:\/\//i.test(href) && (rel.includes('stylesheet') || rel.includes('preload') || rel.includes('icon'))) mixed.push(href);
  }
  for (const tag of text.match(/<meta\b[^>]*>/gi) || []) {
    const name = (attr(tag, 'name') || '').toLowerCase();
    if (name === 'robots' || name === 'googlebot') robots.push(attr(tag, 'content') || '');
  }
  if (isHttps) {
    for (const tag of text.match(/<(?:img|script|iframe|source|video|audio)\b[^>]*>/gi) || []) {
      const src = attr(tag, 'src');
      if (src && /^http:\/\//i.test(src)) mixed.push(src);
    }
  }
  const jsonld = [];
  for (const m of text.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(m[1]); jsonld.push({ ok: true }); } catch (e) { jsonld.push({ ok: false, error: String(e.message || e).slice(0, 80) }); }
  }
  return { canonicals, robots, jsonld, mixed };
}

const same = (a, b) => { try { const x = new URL(a), y = new URL(b); return x.origin === y.origin && x.pathname === y.pathname && x.search === y.search; } catch { return false; } };

/** Problems found in one answer. res = { status, headers (a Headers-like with get), body, ms }. */
export function judge(url, spec, res, opts = {}) {
  const bad = [];
  if (res.status !== spec.status) bad.push(`status ${res.status}, expected ${spec.status}`);
  if (res.ms > MAX_MS) bad.push(`slow: ${res.ms} ms, limit ${MAX_MS} ms`);
  if (spec.status >= 300 && spec.status < 400) {
    if (res.status === spec.status && !res.headers.get('location')) bad.push('redirect has no Location header');
    return bad;
  }
  if (res.status !== 200) return bad;
  const type = String(res.headers.get('content-type') || '').toLowerCase();
  const headerRobots = String(res.headers.get('x-robots-tag') || '');
  if (!opts.allowNoindex && /noindex/i.test(headerRobots)) bad.push('X-Robots-Tag header says noindex');
  if (!type.includes('text/html')) return bad; // sitemaps, JSON and feeds: status, time and header only
  const a = analyseHtml(res.body, /^https:/i.test(url));
  if (a.canonicals.length !== 1) bad.push(a.canonicals.length ? `${a.canonicals.length} canonical links, expected 1` : 'no canonical link');
  else if (!same(a.canonicals[0], url)) bad.push(`canonical is ${a.canonicals[0]}, not this address`);
  if (!opts.allowNoindex && a.robots.some((r) => /noindex/i.test(r))) bad.push('meta robots says noindex');
  a.jsonld.forEach((j, i) => { if (!j.ok) bad.push(`JSON-LD block ${i + 1} does not parse (${j.error})`); });
  for (const m of a.mixed.slice(0, 3)) bad.push(`mixed content: ${m}`);
  return bad;
}

/** Fetches one address (no redirect following) and judges it. Returns { url, ok, problems, line }. */
export async function verifyOne(fetchFn, base, specText, opts = {}, clock = () => Date.now()) {
  const spec = parseSpec(specText);
  const url = new URL(spec.path, base.endsWith('/') ? base : base + '/').toString();
  let res;
  try {
    const t0 = clock();
    const r = await fetchFn(url, { redirect: 'manual', headers: { 'user-agent': 'shivam-das-news-verify-live' } });
    const body = await r.text();
    res = { status: r.status, headers: r.headers, body, ms: clock() - t0 };
  } catch (e) {
    const problems = [`could not open it: ${String(e && e.message || e).slice(0, 100)}`];
    return { url, ok: false, problems, line: `FAIL ${url} - ${problems[0]}` };
  }
  const problems = judge(url, spec, res, opts);
  const ok = problems.length === 0;
  return { url, ok, problems, line: ok ? `PASS ${url} ${res.status} ${res.ms}ms` : `FAIL ${url} - ${problems.join('; ')}` };
}

/** Checks all addresses; returns { ok, lines, last }. */
export async function verifyAll(fetchFn, base, specs, opts = {}, clock) {
  const out = [];
  for (const s of specs) out.push(await verifyOne(fetchFn, base, s, opts, clock));
  const ok = out.length > 0 && out.every((r) => r.ok);
  const bad = out.filter((r) => !r.ok).length;
  return { ok, lines: out.map((r) => r.line), last: ok ? `VERIFY-LIVE PASS (${out.length} address${out.length === 1 ? '' : 'es'})` : out.length ? `VERIFY-LIVE FAIL (${bad} of ${out.length})` : 'VERIFY-LIVE FAIL (no address given)' };
}
