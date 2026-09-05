import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { HttpServices } from './types.js';
import { credentialsSchema } from './schemas.js';
import { bearer, sendError, sendRateLimit } from './http-errors.js';
import { errors } from '../../domain/common/index.js';

export function registerAuthRoutes(
  app: FastifyInstance,
  services: HttpServices,
): void {
  app.post('/api/auth/register', (request, reply) => {
    const limit = services.authLimiter.consume(`register:${request.ip}`);
    if (!limit.allowed) return sendRateLimit(reply, limit.retryAfterSeconds);
    return handleCredentials(request, reply, 201, (email, password) =>
      services.auth.register(email, password),
    );
  });

  app.post('/api/auth/login', (request, reply) => {
    const limit = services.authLimiter.consume(`login:${request.ip}`);
    if (!limit.allowed) return sendRateLimit(reply, limit.retryAfterSeconds);
    return handleCredentials(request, reply, 200, (email, password) =>
      services.auth.login(email, password),
    );
  });

  app.post('/api/auth/logout', async (request, reply) => {
    try {
      const token = bearer(request);
      if (!token || token.length > 4096) throw errors.unauthorized();
      await services.auth.logout(token);
      return { status: 'ok' };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

async function handleCredentials(
  request: FastifyRequest,
  reply: Parameters<typeof sendError>[0],
  statusCode: number,
  operation: (email: string, password: string) => Promise<unknown>,
): Promise<unknown> {
  try {
    const input = credentialsSchema.safeParse(request.body ?? {});
    if (!input.success) throw errors.invalidRequest();
    return reply
      .code(statusCode)
      .send(await operation(input.data.email, input.data.password));
  } catch (error) {
    return sendError(reply, error);
  }
}
