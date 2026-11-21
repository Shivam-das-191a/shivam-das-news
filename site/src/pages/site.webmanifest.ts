import type { APIRoute } from 'astro';
import site from '../../config/site.json';
import { iconState } from '../lib/icons';

export const GET: APIRoute = () => {
  const ic = iconState();
  const icons = [
    ic.i192 && { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ic.i512 && { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ic.maskable && { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ].filter(Boolean);
  const manifest = { name: site.siteName, short_name: site.siteName, start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: site.themeColor, lang: 'en', ...(icons.length ? { icons } : {}) };
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } });
};
