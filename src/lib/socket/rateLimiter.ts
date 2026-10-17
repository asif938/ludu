/** Minimal per-key throttle: rejects an action if the same key acted again
 * before `minIntervalMs` has elapsed. Good enough to blunt accidental or
 * scripted rapid-fire roll/move spam without pulling in a queue system. */
export class RateLimiter {
  private lastActionAt = new Map<string, number>();

  constructor(private minIntervalMs = 250) {}

  allow(key: string): boolean {
    const now = Date.now();
    const last = this.lastActionAt.get(key) ?? 0;
    if (now - last < this.minIntervalMs) return false;
    this.lastActionAt.set(key, now);
    return true;
  }

  clear(key: string): void {
    this.lastActionAt.delete(key);
  }
}

export const actionRateLimiter = new RateLimiter(250);
