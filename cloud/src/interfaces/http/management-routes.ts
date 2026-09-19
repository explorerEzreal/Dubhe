import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { UserRecord } from '../../application/ports.js';
import type { HttpServices } from './types.js';
import { agentParamsSchema, agentUpdateSchema, apiKeySchema, adminPasswordSchema, channelAddSchema, enrollmentCreateSchema, groupAgentSchema, groupCreateSchema, groupUpdateSchema, passwordChangeSchema, profileSchema, userParamsSchema } from './schemas.js';
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
      const input = enrollmentCreateSchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      return reply.code(201).send(await services.enrollment.create(user.id, input.data.name));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/admin/users', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.auth.listUsers(user);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/me', async (request, reply) => {
    try { return await services.auth.me(await authenticatedUser(request, services)); } catch (error) { return sendError(reply, error); }
  });

  app.patch('/api/me/profile', async (request, reply) => {
    try {
      const input = profileSchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      return await services.auth.updateProfile(await authenticatedUser(request, services), input.data);
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/api/me/password', async (request, reply) => {
    try {
      const input = passwordChangeSchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      await services.auth.changeOwnPassword(await authenticatedUser(request, services), input.data.currentPassword, input.data.newPassword);
      return { status: 'ok' };
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/api/admin/users/:id/password', async (request, reply) => {
    try {
      const actor = await authenticatedUser(request, services);
      const params = userParamsSchema.safeParse(request.params);
      const input = adminPasswordSchema.safeParse(request.body ?? {});
      if (!params.success || !input.success) throw errors.invalidRequest();
      await services.auth.changeUserPassword(actor, params.data.id, input.data.newPassword);
      return { status: 'ok' };
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/api/admin/users/:id', async (request, reply) => {
    try {
      const actor = await authenticatedUser(request, services);
      const params = userParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      await services.auth.deleteUser(actor, params.data.id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
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

  app.patch('/api/agents/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      const input = agentUpdateSchema.safeParse(request.body ?? {});
      if (!params.success || !input.success) throw errors.invalidRequest();
      return await services.agents.rename(user.id, params.data.id, input.data.name);
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

  // ─── API Key ───────────────────────────────────────────────────

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
        input.data.channelId,
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

  // ─── 分组管理 ─────────────────────────────────────────────────

  app.post('/api/groups', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const input = groupCreateSchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      const group = await services.groups.create(user.id, input.data.name, input.data.description ?? null);
      return reply.code(201).send(group);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/groups', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.groups.list(user.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/groups/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      return await services.groups.get(user.id, params.data.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/api/groups/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      const input = groupUpdateSchema.safeParse(request.body ?? {});
      if (!params.success || !input.success) throw errors.invalidRequest();
      await services.groups.update(user.id, params.data.id, input.data.name, input.data.description ?? null);
      return { status: 'ok' };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/api/groups/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      await services.groups.delete(user.id, params.data.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/groups/:id/agents', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      const input = groupAgentSchema.safeParse(request.body ?? {});
      if (!params.success || !input.success) throw errors.invalidRequest();
      await services.groups.addAgent(user.id, params.data.id, input.data.agentId);
      return { status: 'ok' };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/api/groups/:id/agents/:agentId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      const agentParams = agentParamsSchema.safeParse({ id: (request.params as { agentId: string }).agentId });
      if (!params.success || !agentParams.success) throw errors.invalidRequest();
      await services.groups.removeAgent(user.id, params.data.id, agentParams.data.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/groups/:id/invite-tokens', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      const token = await services.groups.createInviteToken(user.id, params.data.id);
      return { token };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // ─── 渠道管理 ─────────────────────────────────────────────────

  app.get('/api/channels', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.groups.listChannels(user.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/channels', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const input = channelAddSchema.safeParse(request.body ?? {});
      if (!input.success) throw errors.invalidRequest();
      return await services.groups.acceptInvite(user.id, input.data.token);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/channels/models', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      return await services.groups.listChannelModels(user.id);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/api/channels/:id', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, services);
      const params = agentParamsSchema.safeParse(request.params);
      if (!params.success) throw errors.invalidRequest();
      await services.groups.removeChannel(user.id, params.data.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
