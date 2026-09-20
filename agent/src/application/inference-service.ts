import type { MessageSender } from '../interfaces/websocket/message-sender.js';
import type {
  InferenceBackend,
  InferenceUsage,
} from '../interfaces/inference/index.js';

export interface AgentInferenceRequest {
  request_id: string;
  payload: {
    endpoint: 'chat/completions' | 'responses';
    model: string;
    body: Record<string, unknown>;
    stream: boolean;
    request_bytes: number;
    [key: string]: unknown;
  };
}

export interface AgentInferenceService {
  handleRequest(request: AgentInferenceRequest, sender: MessageSender): Promise<void>;
  cancel(requestId: string): void;
  cancelAll(): void;
  activeCount(): number;
}

interface ActiveTask {
  controller: AbortController;
  cancelled: boolean;
}

export function createInferenceService(
  backend: InferenceBackend,
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
          models = await backend.listModels();
        } catch {
          await sendError(request.request_id, sender, 'LOCAL_SERVICE_UNAVAILABLE');
          return;
        }
        if (!models.includes(request.payload.model)) {
          await sendError(request.request_id, sender, 'MODEL_NOT_READY');
          return;
        }
        let usage: InferenceUsage | undefined;
        let statusCode = 200;
        let responseHeaders: Record<string, string> = {};
        let responseBytes = 0;
        const responseParts: Buffer[] = [];
        let seq = 0;
        const legacyBackend = !backend.request;
        const stream = backend.request
          ? backend.request(request.payload.endpoint, request.payload.model, request.payload.body, task.controller.signal)
          : backend.chat?.(request.payload.model, request.payload, task.controller.signal);
        if (!stream) throw new Error('inference backend unavailable');
        for await (const chunk of stream) {
          if (typeof chunk === 'string') {
            const bytes = Buffer.from(chunk, 'utf8');
            responseParts.push(bytes);
            responseBytes += bytes.byteLength;
            if (request.payload.stream) {
              await sender.send({ protocol_version: 1, type: 'infer_chunk', timestamp: new Date().toISOString(), request_id: request.request_id, payload: legacyBackend ? { seq, content: chunk } : { seq, data: bytes.toString('base64'), content: chunk, encoding: 'base64', response_bytes: responseBytes } });
              seq += 1;
            }
            continue;
          }
          if (!chunk.data && 'content' in chunk && typeof (chunk as { content?: unknown }).content === 'string') {
            const bytes = Buffer.from(String((chunk as { content: string }).content), 'utf8');
            responseParts.push(bytes);
            responseBytes += bytes.byteLength;
            usage = chunk.usage ?? usage;
            if (request.payload.stream) {
              await sender.send({ protocol_version: 1, type: 'infer_chunk', timestamp: new Date().toISOString(), request_id: request.request_id, payload: legacyBackend ? { seq, content: String((chunk as { content: string }).content) } : { seq, data: bytes.toString('base64'), content: String((chunk as { content: string }).content), encoding: 'base64', response_bytes: responseBytes } });
              seq += 1;
            }
            continue;
          }
          if (chunk.statusCode !== undefined) statusCode = chunk.statusCode;
          if (chunk.headers) responseHeaders = chunk.headers;
          responseBytes = chunk.responseBytes;
          usage = chunk.usage ?? usage;
          if (chunk.data) {
            const bytes = Buffer.from(chunk.data, 'base64');
            responseParts.push(bytes);
            if (request.payload.stream) {
              await sender.send({
                protocol_version: 1,
                type: 'infer_chunk',
                timestamp: new Date().toISOString(),
                request_id: request.request_id,
                payload: { seq, data: chunk.data, content: Buffer.from(chunk.data, 'base64').toString('utf8'), encoding: 'base64', response_bytes: responseBytes, ...(seq === 0 ? { status_code: statusCode, headers: responseHeaders } : {}) },
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
            payload: legacyBackend ? {
              content: Buffer.concat(responseParts).toString('utf8'),
              finish_reason: 'stop',
              usage,
            } : {
            status_code: statusCode,
            headers: responseHeaders,
            ...(request.payload.stream ? {} : { body: Buffer.concat(responseParts).toString('base64'), encoding: 'base64' as const }),
            response_bytes: responseBytes,
            content: Buffer.concat(responseParts).toString('utf8'),
            usage,
          },
        });
      } catch {
        if (task.cancelled || task.controller.signal.aborted) return;
        logger.warn({ requestId: request.request_id }, 'inference backend failed');
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
    cancelAll(): void {
      for (const requestId of Array.from(tasks.keys())) {
        const task = tasks.get(requestId);
        if (!task) continue;
        task.cancelled = true;
        task.controller.abort();
        tasks.delete(requestId);
      }
    },
    activeCount(): number {
      return tasks.size;
    },
  };
}
