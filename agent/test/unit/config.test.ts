import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/config.js';

const baseEnv = {
  LOCAL_MODEL_URL: 'http://127.0.0.1:9931',
  MODELS: 'test-model',
};

describe('Agent 配置', () => {
  it('允许本地环回地址使用 ws', () => {
    expect(loadConfig({ ...baseEnv, CLOUD_URL: 'ws://localhost:3000/agent' }).CLOUD_URL)
      .toBe('ws://localhost:3000/agent');
  });

  it('拒绝远程地址使用 ws', () => {
    expect(() => loadConfig({ ...baseEnv, CLOUD_URL: 'ws://example.com/agent' }))
      .toThrow('CLOUD_URL 必须使用 wss');
  });
});
