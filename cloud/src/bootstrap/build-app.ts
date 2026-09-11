import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { CloudConfig } from '../config/config.js';
import {
  AgentService,
  ApiKeyService,
  AuthService,
  CatalogService,
  EnrollmentService,
  InferenceService,
  SlidingWindowRateLimiter,
} from '../application/index.js';
import {
  createDatabase,
  PgAgentRepository,
  PgApiKeyRepository,
  PgAuditRepository,
  PgCatalogRepository,
  PgDatabaseHealth,
  PgEnrollmentTokenRepository,
  PgSessionRepository,
  PgUserRepository,
  PgInferenceRepository,
} from '../infrastructure/database/index.js';
import { HmacSecurityService } from '../infrastructure/security/index.js';
import {
  AgentHeartbeatMonitor,
  InMemoryConnectionRegistry,
} from '../infrastructure/websocket/index.js';
import {
  registerAuthRoutes,
  registerHealthRoutes,
  registerInferenceRoutes,
  registerManagementRoutes,
  registerDownloadRoutes,
  registerErrorHandler,
  type HttpServices,
} from '../interfaces/http/index.js';
import { registerAgentRoutes } from '../interfaces/websocket/index.js';

// 仅负责创建基础设施、应用服务并注册接口。
export function buildApp(app: FastifyInstance, config: CloudConfig): Pool {
  const pool = createDatabase(config);
  const security = new HmacSecurityService(
    config.JWT_SECRET,
    config.API_KEY_PEPPER,
  );
  const audits = new PgAuditRepository(pool);
  const connections = new InMemoryConnectionRegistry();
  const agents = new AgentService(
    new PgAgentRepository(pool),
    audits,
    connections,
    security,
  );
  const inference = new InferenceService(
    new PgInferenceRepository(pool),
    connections,
    config.INFERENCE_TIMEOUT_MS,
    app.log,
  );
  const heartbeatMonitor = new AgentHeartbeatMonitor(
    connections,
    agents,
    config.AGENT_HEARTBEAT_TIMEOUT_MS,
    app.log,
    (agentId) => {
      void inference.handleAgentDisconnected(agentId);
    },
  );
  heartbeatMonitor.start();
  app.addHook('onClose', async () => {
    heartbeatMonitor.stop();
  });
  const services: HttpServices = {
    auth: new AuthService(
      new PgUserRepository(pool),
      new PgSessionRepository(pool),
      audits,
      security,
      config.SESSION_TTL_SECONDS,
    ),
    enrollment: new EnrollmentService(
      new PgEnrollmentTokenRepository(pool),
      audits,
      security,
      config.ENROLLMENT_TOKEN_TTL_SECONDS,
    ),
    agents,
    apiKeys: new ApiKeyService(new PgApiKeyRepository(pool), audits, security),
    catalog: new CatalogService(new PgCatalogRepository(pool)),
    authLimiter: new SlidingWindowRateLimiter(
      config.AUTH_RATE_LIMIT_MAX_REQUESTS,
      config.RATE_LIMIT_WINDOW_SECONDS * 1000,
    ),
    apiLimiter: new SlidingWindowRateLimiter(
      config.RATE_LIMIT_MAX_REQUESTS,
      config.RATE_LIMIT_WINDOW_SECONDS * 1000,
    ),
    inference,
  };

  registerErrorHandler(app);
  registerHealthRoutes(app, new PgDatabaseHealth(pool));
  registerAuthRoutes(app, services);
  registerManagementRoutes(app, services);
  registerDownloadRoutes(app);
  registerInferenceRoutes(app, services);
  registerAgentRoutes(app, {
    path: config.AGENT_WS_PATH,
    requireTls: config.AGENT_REQUIRE_TLS,
    maxMessageBytes: config.AGENT_MAX_MESSAGE_BYTES,
    service: agents,
    connections,
    onInferenceMessage: (agentId, message) => {
      void inference.handleAgentMessage(agentId, message);
    },
    onDisconnect: (agentId) => {
      void inference.handleAgentDisconnected(agentId);
    },
  });

  return pool;
}
