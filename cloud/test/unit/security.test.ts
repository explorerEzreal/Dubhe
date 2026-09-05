import { afterEach, describe, expect, it, vi } from 'vitest';
import { digest, signJwt, verifyJwt } from '../../src/infrastructure/security/index.js';

describe('security primitives', () => {
  afterEach(() => vi.useRealTimers());

  it('signs and verifies a JWT with a session id', () => {
    const token = signJwt({ sub: 'user-1' }, '0123456789abcdef', 60);
    const claims = verifyJwt(token, '0123456789abcdef');
    expect(claims?.sub).toBe('user-1');
    expect(typeof claims?.jti).toBe('string');
    expect(verifyJwt(token, 'wrong-secret-0123')).toBeNull();
  });

  it('issues unique sessions and rejects expired tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T00:00:00Z'));
    const first = signJwt({ sub: 'user-1' }, '0123456789abcdef', 60);
    const second = signJwt({ sub: 'user-1' }, '0123456789abcdef', 60);
    expect(first).not.toBe(second);
    vi.setSystemTime(new Date('2026-09-05T00:01:01Z'));
    expect(verifyJwt(first, '0123456789abcdef')).toBeNull();
  });

  it('produces deterministic HMAC digests without exposing input', () => {
    expect(digest('secret-value', 'pepper')).toBe(digest('secret-value', 'pepper'));
    expect(digest('secret-value', 'pepper')).not.toContain('secret-value');
  });
});
