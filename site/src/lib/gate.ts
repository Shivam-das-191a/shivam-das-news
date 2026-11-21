/** Phase 2: pre-publish warnings (LOGICS 13). Warnings never stop a build; errors do (see content.config.ts). */
const BAIT = /\b(shocking|you won'?t believe|jaw[- ]dropping|mind[- ]blowing|this one trick|what happens next|gone wrong|will blow your mind)\b/i;

export function clickbaitWarning(title: string): string | null {
  const caps = title.split(/\s+/).filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (caps.length >= 2) return 'title has several ALL CAPS words';
  if (BAIT.test(title)) return 'title uses clickbait wording';
  if ((title.match(/[!?]/g) || []).length >= 2) return 'title has repeated ! or ?';
  return null;
}

export function gateWarnings(p: { title: string; words: number; hasInternalLink: boolean }): string[] {
  const w: string[] = [];
  const c = clickbaitWarning(p.title);
  if (c) w.push(c);
  if (p.words < 300) w.push(`only ${p.words} words (news posts should be 300+)`);
  if (!p.hasInternalLink) w.push('no internal link in the body');
  return w;
}
