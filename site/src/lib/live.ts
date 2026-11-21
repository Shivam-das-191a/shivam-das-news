/** v0.2.2: a post or page goes live only when its date has arrived (status "published" + future date = scheduled). */
export const isLive = (date: Date, now: Date): boolean => date.getTime() <= now.getTime();
