import type { FastifyInstance } from 'fastify';
import type { DatabaseHealth } from '../../application/ports.js';

// 存活检查不依赖数据库；就绪检查反映 PostgreSQL 连通性。
export function registerHealthRoutes(
  app: FastifyInstance,
  database: DatabaseHealth,
): void {
  app.get('/healthz', async () => {
    return { status: 'ok' };
  });

  app.get('/readyz', async (_request, reply) => {
    try {
      return (await database.check())
        ? { status: 'ready' }
        : reply.code(503).send({ status: 'unavailable' });
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
}
