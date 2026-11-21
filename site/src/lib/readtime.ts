/** LOGICS.md 9: estimated = ceil(words / 220) minutes. */
export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
export const readTime = (text: string) => Math.max(1, Math.ceil(wordCount(text) / 220));
