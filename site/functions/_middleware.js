// v0.6.0: answers "410 Gone" for archived posts. Cloudflare Pages `_redirects` cannot send 410 (only 301, 302, 303, 307, 308).
// This Function is invoked ONLY for the addresses listed in dist/_routes.json (written at build by scripts/build-redirects.mjs),
// so normal page views never run it and stay free. The list itself is dist/gone.json.

const PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page removed</title><meta name="robots" content="noindex"></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1rem"><h1>This page has been removed</h1><p>The story that used to be here is no longer published.</p><p><a href="/">Go to the home page</a> or <a href="/search/">search the site</a>.</p></body></html>';

/** Returns a 410 Response when `pathname` is in `paths`, otherwise null. Trailing slash is optional in the request. */
export function goneResponse(pathname, paths) {
  const p = pathname.endsWith('/') ? pathname : pathname + '/';
  if (!Array.isArray(paths) || !paths.includes(p)) return null;
  return new Response(PAGE, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const res = await context.env.ASSETS.fetch(new URL('/gone.json', url));
    if (res.ok) {
      const hit = goneResponse(url.pathname, (await res.json()).paths);
      if (hit) return hit;
    }
  } catch {
    // If the list cannot be read, behave like a normal static site.
  }
  return context.next();
}
