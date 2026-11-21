import type { APIRoute } from 'astro';
import robots from '../../config/robots.json';
import { absUrl } from '../lib/seo';

export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /admin/', ...robots.extraDisallow.map((p) => `Disallow: ${p}`), ''];
  for (const bot of robots.blockedBots) lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  lines.push(`Sitemap: ${absUrl('/sitemap-index.xml')}`);
  for (const s of robots.extraSitemaps) lines.push(`Sitemap: ${s}`);
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
