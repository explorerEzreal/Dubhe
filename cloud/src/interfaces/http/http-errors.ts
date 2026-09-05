import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApplicationError } from '../../domain/common/index.js';

export function bearer(request: FastifyRequest): string {
  const authorization = String(request.headers.authorization ?? '');
  return authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
}

export function sendError(reply: FastifyReply, caught: unknown): FastifyReply {
  const error =
    caught instanceof ApplicationError
      ? caught
      : new ApplicationError(500, 'SERVER_ERROR', 'server_error');
  return reply.code(error.statusCode).send({
    error: {
      message: error.message,
      type: error.type,
      code: error.code,
    },
  });
}

export function sendRateLimit(
  reply: FastifyReply,
  retryAfterSeconds: number,
): FastifyReply {
  reply.header('Retry-After', retryAfterSeconds);
  return reply.code(429).send({
    error: {
      message: '请求过于频繁，请稍后重试',
      type: 'rate_limit_error',
      code: 'RATE_LIMITED',
    },
  });
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((caught, request, reply) => {
    app.log.error({ method: request.method, url: request.url }, 'request failed');
    return reply.sent ? reply : sendError(reply, caught);
  });
}
