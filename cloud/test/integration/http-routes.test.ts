import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type {
  AgentService,
  ApiKeyService,
  AuthService,
  CatalogService,
  EnrollmentService,
} from '../../src/application/services/index.js';
import { SlidingWindowRateLimiter } from '../../src/application/rate-limit.js';
import { errors } from '../../src/domain/common/index.js';
import {
  registerAuthRoutes,
  registerHealthRoutes,
  registerInferenceRoutes,
  registerManagementRoutes,
  registerErrorHandler,
  type HttpServices,
} from '../../src/interfaces/http/index.js';

function createServices(authLimit = 10): HttpServices {
  let revoked = false;
  const auth = {
    register: async (email: string) => ({
      token: 'jwt-secret',
      user: { id: 'user-1', email, role: 'user' },
    }),
    login: async (email: string) => ({
      token: 'jwt-secret',
      user: { id: 'user-1', email, role: 'user' },
    }),
    authenticate: async (token: string) => {
      if (token !== 'jwt-secret' || revoked) throw errors.unauthorized();
      return { id: 'user-1', email: 'user@example.com', role: 'user' };
    },
    logout: async (token: string) => {
      if (token !== 'jwt-secret') throw errors.unauthorized();
      revoked = true;
    },
  } as unknown as AuthService;
  const apiKeys = {
    list: async () => [],
    create: async () => ({
      id: '00000000-0000-4000-8000-000000000002',
      prefix: 'dsh_live_test',
      plaintext: 'dsh_live_secret',
    }),
    disable: async () => undefined,
    delete: async () => undefined,
    authenticate: async (key: string) => {
      if (key !== 'dsh_live_secret') throw errors.unauthorized();
      return { id: 'key-1', userId: 'user-1', status: 'active', expiresAt: null };
    },
    listModels: async () => [{ id: 'model-1', name: 'llama3:8b', engine: 'openai-compatible' }],
    assertModelPermission: async (_keyId: string, model: string) => {
      if (model !== 'llama3:8b') {
        throw errors.forbidden('MODEL_NOT_PERMITTED', '模型未授权');
      }
    },
  } as unknown as ApiKeyService;
  return {
    auth,
    enrollment: {
      create: async () => ({ token: 'dsh_enroll_secret', expiresIn: 900 }),
    } as unknown as EnrollmentService,
    agents: {
      list: async () => [],
      get: async () => ({ id: '00000000-0000-4000-8000-000000000001' }),
      rotateCredential: async () => ({ credential: 'dsh_cred_secret', previousCount: 1 }),
      revokeCredentials: async () => undefined,
    } as unknown as AgentService,
    apiKeys,
    catalog: {
      listModels: async () => [],
      getUsage: async () => ({ totalCalls: 0, errorRate: 0, avgLatencyMs: 0 }),
    } as unknown as CatalogService,
    authLimiter: new SlidingWindowRateLimiter(authLimit, 60_000),
    apiLimiter: new SlidingWindowRateLimiter(1, 60_000),
    inference: {
      run: async () => { throw errors.modelOffline(); },
      activeCount: () => 0,
      handleAgentMessage: async () => undefined,
      handleAgentDisconnected: async () => undefined,
    } as never,
  };
}

function createApp(services = createServices()) {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  registerHealthRoutes(app, { check: async () => false });
  registerAuthRoutes(app, services);
  registerManagementRoutes(app, services);
  registerInferenceRoutes(app, services);
  app.get('/boom', async () => {
    try {
      throw new Error('postgres://user:password@database/internal');
    } catch (error) {
      throw error;
    }
  });
  return app;
}

describe('HTTP routes', () => {
  it('validates bodies and returns safe errors', async () => {
    const app = createApp();
    try {
      const invalid = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'bad', password: 'short', database: 'secret' },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json()).toEqual({
        error: {
          message: '请求失败，请稍后重试',
          type: 'invalid_request',
          code: 'INVALID_REQUEST',
        },
      });
      expect(invalid.body).not.toContain('database');
      const failure = await app.inject({ method: 'GET', url: '/boom' });
      expect(failure.statusCode).toBe(500);
      expect(failure.body).not.toContain('postgres');
      expect(failure.body).not.toContain('password');
    } finally {
      await app.close();
    }
  });

  it('revokes logout immediately and reports database readiness', async () => {
    const app = createApp();
    try {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'user@example.com', password: 'password' },
      });
      expect(registered.statusCode).toBe(201);
      expect((await app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(503);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/auth/logout',
            headers: { authorization: 'Bearer jwt-secret' },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/enrollment-tokens',
            headers: { authorization: 'Bearer jwt-secret' },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('isolates route limits and returns Retry-After', async () => {
    const app = createApp(createServices(1));
    try {
      const payload = { email: 'user@example.com', password: 'password' };
      expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload })).statusCode).toBe(200);
      const limited = await app.inject({ method: 'POST', url: '/api/auth/login', payload });
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['retry-after']).toBe('60');
      expect((await app.inject({ method: 'POST', url: '/api/auth/register', payload })).statusCode).toBe(201);

      const headers = { authorization: 'Bearer dsh_live_secret' };
      expect((await app.inject({ method: 'GET', url: '/v1/models', headers })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/v1/models', headers })).statusCode).toBe(429);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/chat/completions',
            headers,
            payload: { model: 'llama3:8b', messages: [{ role: 'user', content: 'hi' }] },
          })
        ).statusCode,
      ).toBe(503);
    } finally {
      await app.close();
    }
  });

  it('validates UUID parameters and creates API keys', async () => {
    const app = createApp();
    const headers = { authorization: 'Bearer jwt-secret' };
    try {
      const invalid = await app.inject({
        method: 'POST',
        url: '/api/keys/not-a-uuid/disable',
        headers,
      });
      expect(invalid.statusCode).toBe(400);
      const created = await app.inject({
        method: 'POST',
        url: '/api/keys',
        headers,
        payload: { models: ['llama3:8b'], expiresAt: '2027-01-01T00:00:00Z' },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().plaintext).toBe('dsh_live_secret');
    } finally {
      await app.close();
    }
  });
});
