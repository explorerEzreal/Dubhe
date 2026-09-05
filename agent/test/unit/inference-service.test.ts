import { describe, expect, it } from 'vitest';
import { createInferenceService } from '../../src/application/inference-service.js';

async function* chunks() {
  yield { content: 'hel' };
  yield { content: 'lo', usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } };
}

describe('agent inference service', () => {
  it('aggregates Ollama chunks and emits infer_done', async () => {
    const sent: unknown[] = [];
    const service = createInferenceService({
      listModels: async () => ['llama3:8b'],
      chat: () => chunks(),
      health: async () => true,
      pullModel: async () => undefined,
    }, 1, { warn: () => undefined });
    await service.handleRequest({ request_id: 'req-1', payload: { model: 'llama3:8b', messages: [{ role: 'user', content: 'hi' }], stream: false } }, { send: async (message) => { sent.push(message); } });
    expect(sent[0]).toMatchObject({ type: 'infer_done', request_id: 'req-1', payload: { content: 'hello', usage: { total_tokens: 4 } } });
  });

  it('reports unavailable models and cancels active work', async () => {
    const sent: unknown[] = [];
    const service = createInferenceService({
      listModels: async () => [],
      chat: async function* () { yield 'unused'; },
      health: async () => true,
      pullModel: async () => undefined,
    }, 1, { warn: () => undefined });
    await service.handleRequest({ request_id: 'req-2', payload: { model: 'missing', messages: [{ role: 'user', content: 'hi' }], stream: false } }, { send: async (message) => { sent.push(message); } });
    expect(sent[0]).toMatchObject({ type: 'infer_error', payload: { code: 'MODEL_NOT_READY' } });
    expect(service.activeCount()).toBe(0);
  });

  it('emits ordered chunks for streaming requests', async () => {
    const sent: unknown[] = [];
    const service = createInferenceService({
      listModels: async () => ['llama3:8b'],
      chat: () => chunks(),
      health: async () => true,
      pullModel: async () => undefined,
    }, 1, { warn: () => undefined });
    await service.handleRequest({ request_id: 'req-stream', payload: { model: 'llama3:8b', messages: [{ role: 'user', content: 'hi' }], stream: true } }, { send: async (message) => { sent.push(message); } });
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ payload: { seq: 0, content: 'hel' } }),
      expect.objectContaining({ payload: { seq: 1, content: 'lo' } }),
    ]));
    expect(sent.at(-1)).toMatchObject({ type: 'infer_done', payload: { usage: { total_tokens: 4 } } });
  });
});
