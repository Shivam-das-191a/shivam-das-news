// v0.13.0: Blogger and WordPress XML import, step 4 = download the images and re-host them (BUGS I2).
// Pure functions. The browser part (fetch + WebP conversion) is passed in as `fetchImage`, so tests can fake it.
import { joinPath } from './github.js';

/** Same rule as the Discover check in validate.js and the editor. */
export const MIN_FEATURED_WIDTH = 1200;
/** Images per commit. Each image is a few hundred KB, so this keeps the tab's memory small. */
export const CHUNK = 100;

/** Same encoding as html-to-md.js uses when it writes an image into Markdown. */
const encUrl = (u) => u.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
const isRemote = (u) => /^https?:\/\//i.test(u || '');

/** Every remote image address of the items that will be saved, once each, in order. Already re-hosted ones are skipped. */
export function collectImages(rows) {
  const seen = new Set();
  for (const r of rows) {
    if (r.skip) continue;
    for (const im of r.images) if (!im.local && isRemote(im.src)) seen.add(im.src);
  }
  return [...seen];
}

/** File name from the address: the last part, without extension, plain lowercase. */
export function stemOf(url) {
  let name = '';
  try { name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || ''); } catch { name = ''; }
  const stem = name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return stem || 'image';
}

/** public/media/imported/<stem>.<ext>, with -2, -3 ... when the name is taken. Adds the result to `taken`. */
export function mediaPath(root, url, ext, taken) {
  const dir = joinPath(root, 'public/media/imported');
  const stem = stemOf(url);
  let path = joinPath(dir, `${stem}.${ext}`);
  for (let n = 2; taken.has(path); n++) path = joinPath(dir, `${stem}-${n}.${ext}`);
  taken.add(path);
  return path;
}

/**
 * Downloads each address once (4 at a time). fetchImage(url) must return { bytes, ext, width } or throw.
 * Returns { map: Map(url -> { path, src, width }), files: [{ path, bytes }], failed: [{ url, reason }] }.
 */
export async function downloadAll(urls, fetchImage, o = {}) {
  const root = o.root || '';
  const taken = o.taken || new Set();
  const map = new Map();
  const files = [];
  const failed = [];
  let next = 0;
  let done = 0;
  const publicLen = joinPath(root, 'public').length;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const img = await fetchImage(url);
        if (!img || !img.bytes || !img.bytes.length) throw new Error('empty file');
        const path = mediaPath(root, url, img.ext, taken);
        map.set(url, { path, src: '/' + path.slice(publicLen + 1), width: img.width ?? null });
        files.push({ path, bytes: img.bytes });
      } catch (e) {
        failed.push({ url, reason: (e && e.message) || 'download failed' });
      }
      done++;
      if (o.onProgress) o.onProgress(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency || 4, urls.length) }, worker));
  return { map, files, failed };
}

/**
 * Rewrites the items with the new addresses: Markdown images and the featured image.
 * A published post whose featured image is under 1200 px wide becomes a draft (the editor rule, BUGS S9).
 * A width that could not be read (gif, svg) only gets a note.
 */
export function applyImages(rows, map) {
  for (const r of rows) {
    if (r.skip) continue;
    for (const im of r.images) {
      const hit = map.get(im.src);
      if (!hit) continue;
      r.markdown = r.markdown.split(`](${encUrl(im.src)})`).join(`](${hit.src})`);
      im.local = hit.src;
    }
    if (r.kind === 'post' && r.image) {
      const hit = map.get(r.image);
      if (!hit) continue;
      r.image = hit.src;
      if (hit.width == null) r.issues.push(`The featured image width could not be checked (it needs ${MIN_FEATURED_WIDTH}+ px for Google Discover).`);
      else if (hit.width < MIN_FEATURED_WIDTH && r.status === 'published') {
        r.status = 'draft';
        r.newUrl = '';
        r.issues.push(`The featured image is only ${hit.width} px wide (Google Discover needs ${MIN_FEATURED_WIDTH}+), so it is saved as a draft.`);
      }
    }
  }
}

export function chunks(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
