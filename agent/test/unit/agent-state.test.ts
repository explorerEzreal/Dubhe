import { describe, it, expect } from 'vitest';
import { canAcceptRequests } from '../../src/domain/agent-state.js';
import { createAgentRuntime } from '../../src/application/agent-runtime.js';
import { loadConfig } from '../../src/config/config.js';
import type { CloudClient } from '../../src/infrastructure/cloud/index.js';

describe('agent-state', () => {
  it('only online agents accept requests', () => {
    expect(canAcceptRequests('online')).toBe(true);
    expect(canAcceptRequests('offline')).toBe(false);
    expect(canAcceptRequests('revoked')).toBe(false);
  });

  it('serializes heartbeat model names with the shared protocol field', async () => {
    const sent: unknown[] = [];
    let online = false;
    const cloudClient: CloudClient = {
      connect: async () => {
        online = true;
      },
      close: () => {
        online = false;
      },
      online: () => online,
      onClose: () => undefined,
      onMessage: () => undefined,
      send: async (value) => {
        sent.push(value);
      },
    };
    const runtime = createAgentRuntime({
      config: loadConfig({
        CLOUD_URL: 'wss://api.example.com/agent',
        AGENT_CREDENTIAL: 'credential',
        MODELS: 'llama3:8b',
      }),
      backend: {
        health: async () => true,
        listModels: async () => ['llama3:8b'],
        chat: async () => ({ stream: null }),
      } as never,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
      },
      collectMetrics: async () => ({ cpu: 1 }),
      loadCredentials: async () => ({}),
      saveCredentials: async () => undefined,
      registerDevice: async () => ({}),
      createCloudClient: () => cloudClient,
    });

    await runtime.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(sent[0]).toMatchObject({
      type: 'heartbeat',
      payload: {
        status: 'online',
        models: [{ name: 'llama3:8b', state: 'ready' }],
      },
    });
    expect(JSON.stringify(sent[0])).not.toContain('"model"');
    await runtime.stop();
  });
});
