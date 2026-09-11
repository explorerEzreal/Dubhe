import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ApiKeyIdentity } from '../../application/ports.js';
import type { HttpServices } from './types.js';
import { completionSchema } from './schemas.js';
import { bearer, sendError, sendRateLimit } from './http-errors.js';
import { errors } from '../../domain/common/index.js';

async function authenticatedKey(
  request: FastifyRequest,
  services: HttpServices,
): Promise<ApiKeyIdentity> {
  try {
    const key = bearer(request);
    if (!key || key.length > 512) throw errors.unauthorized();
    return await services.apiKeys.authenticate(key);
  } catch (error) {
    throw error;
  }
}

export function registerInferenceRoutes(
  app: FastifyInstance,
  services: HttpServices,
): void {
  for (const prefix of ['/v1', '/api/v1'] as const) {
    app.get(`${prefix}/models`, async (request, reply) => {
    try {
      const key = await authenticatedKey(request, services);
      const limit = services.apiLimiter.consume(`${key.id}:models`);
      if (!limit.allowed) return sendRateLimit(reply, limit.retryAfterSeconds);
      const models = await services.apiKeys.listModels(key.id);
      return {
        object: 'list',
        data: models.map((model) => ({
          ...model,
          object: 'model',
          owned_by: 'local',
        })),
      };
    } catch (error) {
      return sendError(reply, error);
    }
    });

    app.post(`${prefix}/chat/completions`, async (request, reply) => {
    let requestId: string | undefined;
    let streamCreated = Math.floor(Date.now() / 1000);
    let settled = false;
    let streamStarted = false;
    let streamMode = false;
    const cancelOnClose = (): void => {
      if (!settled && requestId) void services.inference.cancel(requestId);
    };
    request.raw.once('aborted', cancelOnClose);
    reply.raw.once('close', cancelOnClose);
    try {
      const key = await authenticatedKey(request, services);
      const limit = services.apiLimiter.consume(`${key.id}:chat`);
      if (!limit.allowed) return sendRateLimit(reply, limit.retryAfterSeconds);
      const input = completionSchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      await services.apiKeys.assertModelPermission(key.id, input.data.model);
      const result = await services.inference.run({
        userId: key.userId,
        apiKeyId: key.id,
        model: input.data.model,
        payload: input.data,
        onStart: (id, created) => {
          requestId = id;
          streamCreated = created;
          if (input.data.stream) {
            streamMode = true;
            reply.hijack();
            reply.raw.statusCode = 200;
            reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
            reply.raw.setHeader('cache-control', 'no-cache');
            reply.raw.setHeader('connection', 'keep-alive');
          }
        },
        onChunk: input.data.stream ? (chunk) => {
          if (!requestId) return;
          if (!streamStarted) {
            reply.raw.write(`data: ${JSON.stringify({ id: `chatcmpl-${requestId}`, object: 'chat.completion.chunk', created: streamCreated, model: input.data.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);
          }
          streamStarted = true;
          const body = {
            id: `chatcmpl-${requestId}`,
            object: 'chat.completion.chunk',
            created: streamCreated,
            model: input.data.model,
            choices: [{ index: 0, delta: { content: chunk.content }, finish_reason: null }],
          };
          reply.raw.write(`data: ${JSON.stringify(body)}\n\n`);
        } : undefined,
      });
      settled = true;
      if (input.data.stream) {
        if (!streamStarted) {
          reply.raw.write(`data: ${JSON.stringify({ id: `chatcmpl-${result.requestId}`, object: 'chat.completion.chunk', created: result.created, model: result.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);
        }
        reply.raw.write(`data: ${JSON.stringify({ id: `chatcmpl-${result.requestId}`, object: 'chat.completion.chunk', created: result.created, model: result.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: result.usage })}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }
      return {
        id: `chatcmpl-${result.requestId}`,
        object: 'chat.completion',
        created: result.created,
        model: result.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.content },
          finish_reason: 'stop',
        }],
        usage: result.usage,
      };
    } catch (error) {
      settled = true;
      if (streamMode && (streamStarted || requestId)) {
        reply.raw.write(`data: ${JSON.stringify({ error: { message: '请求失败，请稍后重试', type: 'inference_error', code: error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : 'UPSTREAM_ERROR' } })}\n\n`);
        reply.raw.end();
        return reply;
      }
      return sendError(reply, error);
    }
    });
  }
}
