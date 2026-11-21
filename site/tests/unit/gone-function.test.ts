import { describe, it, expect } from 'vitest';
// @ts-ignore plain JavaScript file used by Cloudflare Pages
import { goneResponse, onRequest } from '../../functions/_middleware.js';

describe('Pages Function for 410', () => {
  it('answers 410 for a listed address, with or without the trailing slash', async () => {
    const r = goneResponse('/2026/11/12/blogs/tech/a', ['/2026/11/12/blogs/tech/a/']);
    expect(r!.status).toBe(410);
    expect(await r!.text()).toContain('This page has been removed');
    expect(goneResponse('/2026/11/12/blogs/tech/a/', ['/2026/11/12/blogs/tech/a/'])!.status).toBe(410);
  });
  it('returns null for anything else', () => {
    expect(goneResponse('/other/', ['/a/'])).toBeNull();
    expect(goneResponse('/a/', undefined as any)).toBeNull();
  });
  it('onRequest reads gone.json and answers 410, otherwise passes on', async () => {
    const env = { ASSETS: { fetch: async () => new Response(JSON.stringify({ paths: ['/gone/'] })) } };
    const next = async () => new Response('page', { status: 200 });
    const hit = await onRequest({ request: new Request('https://news.test/gone/'), env, next });
    expect(hit.status).toBe(410);
    const miss = await onRequest({ request: new Request('https://news.test/live/'), env, next });
    expect(miss.status).toBe(200);
  });
  it('passes on when gone.json cannot be read', async () => {
    const env = { ASSETS: { fetch: async () => { throw new Error('down'); } } };
    const res = await onRequest({ request: new Request('https://news.test/x/'), env, next: async () => new Response('ok') });
    expect(res.status).toBe(200);
  });
});
