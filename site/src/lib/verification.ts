/** v0.83.1: site verification codes (Google, Bing, Yandex) for the <meta> tags in the page head (PLAN 14).
 *  One value or several: Google Search Console gives one code for each property, so a site may need two or more on the same pages.
 *  Accepted in `config/site.json`: a text ("code"), a text with several codes separated by commas, spaces or new lines ("a, b"; this is what the
 *  dashboard Settings screen saves), or a list (["a", "b"]).
 *  A code is kept only when it is made of letters, digits, hyphen, underscore, dot or an equals sign, 10 to 200 characters. If someone pasted the whole
 *  meta tag, the content="..." part is taken. Anything else is dropped (nothing is ever written into the page head from a bad value). Repeats are removed. */
const CODE = /^[A-Za-z0-9_.=-]{10,200}$/;
export const MAX_CODES = 5;

export function verificationCodes(value: unknown): string[] {
  const parts: string[] = [];
  const take = (v: unknown) => {
    if (typeof v !== 'string') return;
    const tag = v.match(/content\s*=\s*["']([^"']+)["']/i);
    const text = tag ? tag[1] : v;
    for (const piece of text.split(/[\s,;]+/)) if (piece) parts.push(piece);
  };
  if (Array.isArray(value)) value.forEach(take);
  else take(value);
  const out: string[] = [];
  for (const p of parts) if (CODE.test(p) && !out.includes(p)) out.push(p);
  return out.slice(0, MAX_CODES);
}
