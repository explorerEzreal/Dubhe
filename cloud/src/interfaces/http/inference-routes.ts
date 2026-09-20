import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ApiKeyIdentity } from '../../application/ports.js';
import type { HttpServices } from './types.js';
import { bearer, sendError, sendRateLimit } from './http-errors.js';
import { errors } from '../../domain/common/index.js';

type Endpoint = 'chat/completions' | 'responses';

async function authenticatedKey(request: FastifyRequest, services: HttpServices): Promise<ApiKeyIdentity> {
  const key = bearer(request);
  if (!key || key.length > 512) throw errors.unauthorized();
  return services.apiKeys.authenticate(key);
}

function requestBody(request: FastifyRequest): Record<string, unknown> {
  const body = request.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw errors.invalidRequest();
  const record = body as Record<string, unknown>;
  if (typeof record.model !== 'string' || record.model.length < 1 || record.model.length > 200) throw errors.invalidRequest();
  return record;
}

function copyHeaders(headers: Record<string, string>, reply: { header: (name: string, value: string) => unknown }): void {
  for (const [name, value] of Object.entries(headers)) {
    if (/^(content-type|cache-control|etag|last-modified|retry-after)$/i.test(name)) reply.header(name, value);
  }
}

export function registerInferenceRoutes(app: FastifyInstance, services: HttpServices): void {
  for (const prefix of ['/v1', '/api/v1'] as const) {
    app.get(`${prefix}/models`, async (request, reply) => {
      try {
        const key = await authenticatedKey(request, services);
        const limit = services.apiLimiter.consume(`${key.id}:models`);
        if (!limit.allowed) return sendRateLimit(reply, limit.retryAfterSeconds);
        if (!key.groupId) return { object: 'list', data: [] };
        const models = await services.apiKeys.listModelsByGroup(key.groupId);
        return {
          object: 'list',
          data: models.map((model) => ({
            ...model,
            // OpenAI 客户端会把 id 原样用于后续推理请求，必须使用模型名称而非数据库 UUID。
            id: String(model.name),
            object: 'model',
            owned_by: 'local',
          })),
        };
      } catch (error) { return sendError(reply, error); }
    });

    const register = (endpoint: Endpoint) => app.post(`${prefix}/${endpoint}`, async (request, reply) => {
      let requestId: string | undefined;
      let streamMode = false;
      let settled = false;
      const cancelOnClose = (): void => { if (!settled && requestId) void services.inference.cancel(requestId); };
      request.raw.once('aborted', cancelOnClose);
      reply.raw.once('close', cancelOnClose);
      try {
        const key = await authenticatedKey(request, services);
        const limit = services.apiLimiter.consume(`${key.id}:${endpoint}`);
        if (!limit.allowed) return sendRateLimit(reply, limit.retryAfterSeconds);
        const body = requestBody(request);
        const stream = body.stream === true;
        const requestBytes = Buffer.byteLength(JSON.stringify(body));
        const result = await services.inference.run({ userId: key.userId, apiKeyId: key.id, groupId: key.groupId, model: String(body.model), endpoint, payload: body, requestBytes,
          onStart: (id) => { requestId = id; if (stream) { streamMode = true; reply.hijack(); reply.raw.statusCode = 200; reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8'); reply.raw.setHeader('cache-control', 'no-cache'); } },
          onChunk: stream ? (chunk) => {
            if (chunk.statusCode && !reply.raw.headersSent) reply.raw.statusCode = chunk.statusCode;
            if (chunk.headers && !reply.raw.headersSent) copyHeaders(chunk.headers, reply);
            if (chunk.data) reply.raw.write(Buffer.from(chunk.data, 'base64'));
          } : undefined,
        });
        settled = true;
        if (stream) { reply.raw.end(); return reply; }
        copyHeaders(result.headers, reply);
        reply.code(result.statusCode);
        return result.body ? Buffer.from(result.body, result.encoding === 'base64' ? 'base64' : 'utf8') : Buffer.alloc(0);
      } catch (error) {
        settled = true;
        if (streamMode && requestId) { reply.raw.end(); return reply; }
        return sendError(reply, error);
      }
    });
    register('chat/completions');
    register('responses');
  }
}
