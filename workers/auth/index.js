// GitHub OAuth for the dashboard (Cloudflare Worker). The token goes only to ADMIN_ORIGIN, never to "*".
// Secrets: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET. Vars: ADMIN_ORIGIN (for example https://news.example), ALLOWED_USERS (optional, comma list), GITHUB_SCOPE (default "repo").

export const parseCookies = (h) => Object.fromEntries((h || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));

export function authorizeUrl(env, state, redirectUri) {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', env.GITHUB_SCOPE || 'repo');
  u.searchParams.set('state', state);
  return u.toString();
}

export const isAllowed = (env, login) => {
  const list = (env.ALLOWED_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(String(login).toLowerCase());
};

const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export function callbackHtml(origin, payload) {
  return `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in</title><p>Signing in…</p>
<script>
(function(){var o=${safeJson(origin)},m=${safeJson({ type: 'shivam-admin-auth', ...payload })};
if(window.opener){window.opener.postMessage(m,o);window.close();}else{document.body.textContent='You can close this window.';}})();
</script>`;
}

const page = (msg, status = 400) => new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><p>${msg}</p>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.ADMIN_ORIGIN) return page('Worker is not configured.', 500);
    const redirectUri = `${url.origin}/callback`;

    if (url.pathname === '/auth') {
      const state = crypto.randomUUID();
      return new Response(null, {
        status: 302,
        headers: {
          Location: authorizeUrl(env, state, redirectUri),
          'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const saved = parseCookies(request.headers.get('Cookie')).oauth_state;
      if (!code || !state || !saved || state !== saved) return page('Sign-in expired. Close this window and try again.');
      const tr = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'news-admin-auth' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
      });
      const t = await tr.json();
      if (!t.access_token) return page('GitHub did not give a token. Try again.');
      const ur = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${t.access_token}`, 'User-Agent': 'news-admin-auth', Accept: 'application/vnd.github+json' } });
      const user = ur.ok ? await ur.json() : null;
      if (!user || !isAllowed(env, user.login)) return page('This GitHub account is not allowed to use the dashboard.', 403);
      return new Response(callbackHtml(env.ADMIN_ORIGIN, { token: t.access_token, login: user.login }), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' },
      });
    }
    return page('Not found.', 404);
  },
};
