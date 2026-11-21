/** Phase 2: icons exist only after `npm run icons` made them from the owner's logo (no placeholder icons, PLAN 25). */
import fs from 'node:fs';
import path from 'node:path';

const has = (f: string) => fs.existsSync(path.join(process.cwd(), 'public', f));

export const iconState = () => ({
  ico: has('favicon.ico'),
  favicon: has('favicon-32.png'),
  apple: has('apple-touch-icon.png'),
  i192: has('icon-192.png'),
  i512: has('icon-512.png'),
  maskable: has('icon-maskable-512.png'),
});
