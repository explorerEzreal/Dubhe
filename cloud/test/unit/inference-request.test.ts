import { describe, it, expect } from 'vitest';
import { isTerminal } from '../../src/domain/inference/inference-request.js';

describe('inference-request', () => {
  it('recognizes terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('agent_disconnected')).toBe(true);
    expect(isTerminal('running')).toBe(false);
  });
});
