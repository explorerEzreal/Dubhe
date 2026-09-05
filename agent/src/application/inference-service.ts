import type { MessageSender } from '../interfaces/websocket/message-sender.js';
import type { OllamaClient, OllamaUsage } from '../interfaces/ollama/ollama-client.js';

export interface AgentInferenceRequest {
  request_id: string;
  payload: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    stream: boolean;
    [key: string]: unknown;
  };
}

export interface AgentInferenceService {
  handleRequest(request: AgentInferenceRequest, sender: MessageSender): Promise<void>;
  cancel(requestId: string): void;
  activeCount(): number;
}

interface ActiveTask {
  controller: AbortController;
  cancelled: boolean;
}

function emptyUsage(): OllamaUsage {
  return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
}

export function createInferenceService(
  ollama: OllamaClient,
  maxConcurrency: number,
  logger: { warn(object: Record<string, unknown>, message: string): void },
): AgentInferenceService {
  const tasks = new Map<string, ActiveTask>();

  const sendError = async (
    requestId: string,
    sender: MessageSender,
    code: string,
  ): Promise<void> => {
    try {
      await sender.send({
        protocol_version: 1,
        type: 'infer_error',
        timestamp: new Date().toISOString(),
        request_id: requestId,
        payload: { code },
      });
    } catch {
      logger.warn({ requestId }, 'inference error delivery failed');
    }
  };

  return {
    async handleRequest(request, sender): Promise<void> {
      if (tasks.has(request.request_id)) return;
      if (tasks.size >= maxConcurrency) {
        await sendError(request.request_id, sender, 'CONCURRENCY_LIMIT');
        return;
      }
      const task: ActiveTask = { controller: new AbortController(), cancelled: false };
      tasks.set(request.request_id, task);
      try {
        let models: string[];
        try {
          models = await ollama.listModels();
        } catch {
          await sendError(request.request_id, sender, 'OLLAMA_UNAVAILABLE');
          return;
        }
        if (!models.includes(request.payload.model)) {
          await sendError(request.request_id, sender, 'MODEL_NOT_READY');
          return;
        }
        let content = '';
        let usage = emptyUsage();
        let seq = 0;
        for await (const chunk of ollama.chat(
          request.payload.model,
          request.payload,
          task.controller.signal,
        )) {
          if (typeof chunk === 'string') content += chunk;
          else {
            content += chunk.content ?? '';
            usage = chunk.usage ?? usage;
          }
          if (request.payload.stream) {
            const text = typeof chunk === 'string' ? chunk : chunk.content ?? '';
            if (text) {
              await sender.send({
                protocol_version: 1,
                type: 'infer_chunk',
                timestamp: new Date().toISOString(),
                request_id: request.request_id,
                payload: { seq, content: text },
              });
              seq += 1;
            }
          }
        }
        if (task.cancelled) return;
        await sender.send({
          protocol_version: 1,
          type: 'infer_done',
          timestamp: new Date().toISOString(),
          request_id: request.request_id,
          payload: { content, finish_reason: 'stop', usage },
        });
      } catch {
        if (task.cancelled || task.controller.signal.aborted) return;
        logger.warn({ requestId: request.request_id }, 'ollama inference failed');
        await sendError(request.request_id, sender, 'UPSTREAM_ERROR');
      } finally {
        tasks.delete(request.request_id);
      }
    },
    cancel(requestId): void {
      const task = tasks.get(requestId);
      if (!task) return;
      task.cancelled = true;
      task.controller.abort();
      tasks.delete(requestId);
    },
    activeCount(): number {
      return tasks.size;
    },
  };
}
