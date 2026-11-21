import type { APIRoute } from 'astro';
import ads from '../../config/ads.json';
import { buildAdsTxt } from '../lib/ads-txt';

// v0.17.0: /ads.txt from config/ads.json. Empty until the owner adds a real AdSense id or lines from an ad network (PLAN 25: nothing fake).
export const GET: APIRoute = () => new Response(buildAdsTxt(ads).text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
