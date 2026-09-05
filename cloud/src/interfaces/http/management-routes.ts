import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { UserRecord } from '../../application/ports.js';
import type { HttpServices } from './types.js';
import { agentParamsSchema, apiKeySchema } from './schemas.js';
import { bearer, sendError } from './http-errors.js';
import { errors } from '../../domain/common/index.js';

async function authenticatedUser(
  request: FastifyRequest,
  services: HttpServices,
): Promise<UserRecord> {
  try {
    const token = bearer(request);
    if (!token || token.length > 4096) throw errors.unauthorized();
    return await services.auth.authenticate(token);
  } catch (error) {
    throw error;
  }
}

export function registerManagementRoutes(
  app: FastifyInstance,
  services: HttpServices,
): void {
  app.post('/api/enrollment-tokens', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return reply.code(201).send(await services.enrollment.create(user.id));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/agents', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.agents.list(user.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/agents/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      return await services.agents.get(user.id, params.data.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/agents/:id/credentials/rotate', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      return await services.agents.rotateCredential(user.id, params.data.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/agents/:id/credentials/revoke', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      await services.agents.revokeCredentials(user.id, params.data.id);
      return { status: 'revoked' };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/models', async (request, reply) => {
    try {
      await authenticatedUser(request, services);
      return await services.catalog.listModels();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/usage', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.catalog.getUsage(user.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/keys', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.apiKeys.list(user.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/keys', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const input = apiKeySchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      const expiresAt = input.data.expiresAt
        ? new Date(input.data.expiresAt)
        : null;
      const key = await services.apiKeys.create(
        user.id,
        input.data.models,
        expiresAt,
      );
      return reply.code(201).send(key);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/keys/:id/disable', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      await services.apiKeys.disable(user.id, params.data.id);
      return { status: 'disabled' };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/api/keys/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      await services.apiKeys.delete(user.id, params.data.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
