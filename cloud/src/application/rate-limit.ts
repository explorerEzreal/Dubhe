import type { RateLimiter } from './ports.js';

export class SlidingWindowRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly maxRequests: number, private readonly windowMs: number) {}

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const cutoff = now - this.windowMs;
    const current = (this.buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (current.length >= this.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current[0] + this.windowMs - now) / 1000));
      this.buckets.set(key, current);
      return { allowed: false, retryAfterSeconds };
    }
    current.push(now);
    this.buckets.set(key, current);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear(key?: string): void {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}
