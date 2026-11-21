/** v0.101.29: the two helpers the pages use, bound to config/media.json (rules and tests: media-alt.ts). */
import fs from 'node:fs';
import path from 'node:path';
import media from '../../config/media.json';
import { pictureAlt, pictureCaption } from './media-alt';
import { pictureSet, withPictureSets, SIZES, type PictureSet } from './picture-set';

export const altOf = (src?: string, postAlt?: string): string => pictureAlt(media, src, postAlt);
export const captionOf = (src?: string, postCredit?: string): { caption: string; credit: string } => pictureCaption(media, src, postCredit);

/** v0.101.66: the srcset and sizes of a picture (rules and tests: picture-set.ts). A copy is listed only when its file is in public/, so a srcset never names a missing copy. */
const copyExists = (p: string): boolean => fs.existsSync(path.join(process.cwd(), 'public', p.replace(/^\/+/, '')));
export const setOf = (src: string | undefined, sizes: string): PictureSet | null => pictureSet(media, src, sizes, copyExists);

/** v0.101.67: the pictures inside the article text get srcset and sizes too (rules and tests: picture-set.ts). */
export const bodySets = (html: string): string => withPictureSets(html, media, SIZES.body, copyExists);
