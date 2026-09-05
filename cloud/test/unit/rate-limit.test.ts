import { describe, expect, it } from 'vitest';
import { SlidingWindowRateLimiter } from '../../src/application/rate-limit.js';

describe('sliding window rate limiter', () => {
  it('isolates keys and returns retry duration', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    expect(limiter.consume('a', 0).allowed).toBe(true);
    expect(limiter.consume('a', 10).allowed).toBe(true);
    const blocked = limiter.consume('a', 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(limiter.consume('b', 20).allowed).toBe(true);
  });

  it('expires timestamps outside the window', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    expect(limiter.consume('a', 0).allowed).toBe(true);
    expect(limiter.consume('a', 1001).allowed).toBe(true);
  });
});
