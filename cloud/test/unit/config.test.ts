import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/config.js';

const valid = {
  DATABASE_URL: 'postgres://cloud:cloud@localhost:5432/cloud',
  JWT_SECRET: 'jwt-secret-with-at-least-32-characters',
  API_KEY_PEPPER: 'api-pepper-with-at-least-32-characters',
};

describe('Cloud config', () => {
  it('uses secure defaults', () => {
    const config = loadConfig(valid);
    expect(config.AGENT_REQUIRE_TLS).toBe(true);
    expect(config.TRUST_PROXY).toBe(false);
    expect(config.RATE_LIMIT_MAX_REQUESTS).toBe(60);
    expect(config.MAX_REQUEST_BODY_BYTES).toBe(1_048_576);
    expect(config.AGENT_HEARTBEAT_TIMEOUT_MS).toBe(30_000);
  });

  it('rejects weak secrets and invalid paths', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'short' })).toThrow();
    expect(() => loadConfig({ ...valid, AGENT_WS_PATH: 'agent' })).toThrow();
  });
});
