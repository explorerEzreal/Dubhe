import { describe, expect, it, vi } from 'vitest';
import { InferenceService } from '../../src/application/services/inference-service.js';
import type { ConnectionRegistry, InferenceRepository } from '../../src/application/ports.js';

class FakeSocket {
  readonly sent: string[] = [];
  send(value: string): void { this.sent.push(value); }
  close(): void {}
  on(): void {}
}

function repository(snapshot: Parameters<InferenceRepository['getSnapshot']>[0] extends string ? Awaited<ReturnType<InferenceRepository['getSnapshot']>> : never): InferenceRepository {
  return {
    getSnapshot: async () => snapshot,
    createAccepted: vi.fn(async () => undefined),
    markRouted: vi.fn(async () => undefined),
    finish: vi.fn(async () => undefined),
  };
}

function connections(socket: FakeSocket): ConnectionRegistry {
  return {
    add: () => undefined,
    remove: () => false,
    closeAgent: () => undefined,
    get: () => socket as never,
    touch: () => undefined,
    getStale: () => [],
  };
}

const candidate = {
  modelId: 'model-1', modelName: 'llama3:8b', agentId: 'agent-1',
  agentStatus: 'online' as const, state: 'ready' as const,
  maxConcurrency: 1, lastUsedAt: new Date(0),
};

describe('InferenceService', () => {
  it('routes a request and resolves on infer_done', async () => {
    const socket = new FakeSocket();
    const repo = repository({ modelExists: true, instances: [candidate] });
    const service = new InferenceService(repo, connections(socket), 1000, { warn: () => undefined });
    const pending = service.run({ userId: 'user-1', apiKeyId: 'key-1', model: 'llama3:8b', payload: { model: 'llama3:8b', messages: [{ role: 'user', content: 'hi' }], stream: false } });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requestId = JSON.parse(socket.sent[0]).request_id as string;
    await service.handleAgentMessage('agent-1', {
      protocol_version: 1, type: 'infer_done', timestamp: new Date().toISOString(), request_id: requestId,
      payload: { content: 'hello', finish_reason: 'stop', usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } },
    });
    await expect(pending).resolves.toMatchObject({ content: 'hello', usage: { total_tokens: 3 } });
    expect(service.activeCount()).toBe(0);
  });

  it('classifies unavailable states and cleans up on timeout', async () => {
    const socket = new FakeSocket();
    const offline = new InferenceService(repository({ modelExists: true, instances: [{ ...candidate, agentStatus: 'offline' }] }), connections(socket), 20, { warn: () => undefined });
    await expect(offline.run({ userId: 'u', apiKeyId: 'k', model: 'llama3:8b', payload: {} })).rejects.toMatchObject({ code: 'MODEL_OFFLINE' });
    const notReady = new InferenceService(repository({ modelExists: true, instances: [{ ...candidate, state: 'error' }] }), connections(socket), 20, { warn: () => undefined });
    await expect(notReady.run({ userId: 'u', apiKeyId: 'k', model: 'llama3:8b', payload: {} })).rejects.toMatchObject({ code: 'MODEL_NOT_READY' });
    const busy = new InferenceService(repository({ modelExists: true, instances: [{ ...candidate, maxConcurrency: 0 }] }), connections(socket), 20, { warn: () => undefined });
    await expect(busy.run({ userId: 'u', apiKeyId: 'k', model: 'llama3:8b', payload: {} })).rejects.toMatchObject({ code: 'AGENT_BUSY' });
    const timeout = new InferenceService(repository({ modelExists: true, instances: [candidate] }), connections(socket), 5, { warn: () => undefined });
    await expect(timeout.run({ userId: 'u', apiKeyId: 'k', model: 'llama3:8b', payload: {} })).rejects.toMatchObject({ code: 'INFERENCE_TIMEOUT' });
    expect(socket.sent.map((item) => JSON.parse(item).type)).toContain('infer_cancel');
    expect(timeout.activeCount()).toBe(0);
  });

  it('rejects disconnected agents and ignores duplicate completions', async () => {
    const socket = new FakeSocket();
    const service = new InferenceService(repository({ modelExists: true, instances: [candidate] }), connections(socket), 1000, { warn: () => undefined });
    const pending = service.run({ userId: 'u', apiKeyId: 'k', model: 'llama3:8b', payload: {} });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requestId = JSON.parse(socket.sent[0]).request_id as string;
    await service.handleAgentDisconnected('agent-1');
    await expect(pending).rejects.toMatchObject({ code: 'AGENT_DISCONNECTED' });
    await service.handleAgentMessage('agent-1', { request_id: requestId, type: 'infer_done' });
    expect(service.activeCount()).toBe(0);
  });

  it('forwards ordered stream chunks and rejects sequence drift', async () => {
    const socket = new FakeSocket();
    const repo = repository({ modelExists: true, instances: [candidate] });
    const chunks: string[] = [];
    const service = new InferenceService(repo, connections(socket), 1000, { warn: () => undefined });
    const pending = service.run({ userId: 'u', apiKeyId: 'k', model: 'llama3:8b', payload: { stream: true }, onChunk: (chunk) => chunks.push(chunk.content) });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requestId = JSON.parse(socket.sent[0]).request_id as string;
    const envelope = (type: string, payload: Record<string, unknown>) => ({ protocol_version: 1, type, timestamp: new Date().toISOString(), request_id: requestId, payload });
    await service.handleAgentMessage('agent-1', envelope('infer_chunk', { seq: 0, content: 'he' }));
    await service.handleAgentMessage('agent-1', envelope('infer_chunk', { seq: 2, content: 'llo' }));
    await expect(pending).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    expect(chunks).toEqual(['he']);
    expect(service.activeCount()).toBe(0);
  });
});
