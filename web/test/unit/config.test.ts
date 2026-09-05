import { describe, it, expect } from 'vitest';
import { config } from '../../src/config/config';

describe('web config', () => {
  it('has an api base url', () => {
    expect(typeof config.apiBaseUrl).toBe('string');
    expect(config.apiBaseUrl.length).toBeGreaterThan(0);
  });
});
