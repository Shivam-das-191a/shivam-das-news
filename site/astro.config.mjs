import { defineConfig } from 'astro/config';

// Set SITE_URL in your host (Cloudflare Pages) once the real domain is chosen.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
});
