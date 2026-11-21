import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS Worker
import worker, { authorizeUrl, callbackHtml, isAllowed, parseCookies } from '../../../workers/auth/index.js';

const env = { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'sec', ADMIN_ORIGIN: 'https://news.test' };

describe('auth Worker', () => {
  it('starts sign-in with a state cookie and the right GitHub URL', async () => {
    const res = await worker.fetch(new Request('https://auth.test/auth'), env);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('Location')!);
    expect(loc.origin + loc.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(loc.searchParams.get('redirect_uri')).toBe('https://auth.test/callback');
    const cookie = res.headers.get('Set-Cookie')!;
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure');
    expect(cookie).toContain(loc.searchParams.get('state')!);
  });
  it('rejects a callback whose state does not match the cookie', async () => {
    const res = await worker.fetch(new Request('https://auth.test/callback?code=x&state=bad', { headers: { Cookie: 'oauth_state=good' } }), env);
    expect(res.status).toBe(400);
  });
  it('sends the token only to the admin origin, never "*"', () => {
    const html = callbackHtml('https://news.test', { token: 't</script>', login: 'a' });
    expect(html).toContain('"https://news.test"');
    expect(html).not.toContain("'*'"); expect(html).not.toContain('"*"');
    expect(html).not.toContain('t</script>');
  });
  it('limits who may sign in, and reports a missing setup', async () => {
    expect(isAllowed({ ALLOWED_USERS: 'Sam, lee' }, 'sam')).toBe(true);
    expect(isAllowed({ ALLOWED_USERS: 'sam' }, 'eve')).toBe(false);
    expect(isAllowed({}, 'anyone')).toBe(true);
    expect((await worker.fetch(new Request('https://auth.test/auth'), {})).status).toBe(500);
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' });
    expect(authorizeUrl({ GITHUB_CLIENT_ID: 'c' }, 's', 'https://x/cb')).toContain('scope=repo');
  });
});
