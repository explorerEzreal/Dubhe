import { describe, it, expect } from 'vitest';
import { isRoutable } from '../../src/domain/agents/agent-status.js';

describe('agent-status', () => {
  it('only online agents are routable', () => {
    expect(isRoutable('online')).toBe(true);
    expect(isRoutable('offline')).toBe(false);
    expect(isRoutable('revoked')).toBe(false);
  });
});
