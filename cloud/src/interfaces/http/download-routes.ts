import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

// 保留旧下载地址，内容改为 npm Agent 安装引导，不再提供内置制品。
export function registerDownloadRoutes(app: FastifyInstance): void {
  const scriptPath = resolve(process.cwd(), 'releases/install.sh');
  app.get('/downloads/agent/install.sh', async (_request, reply) => {
    const script = await readFile(scriptPath, 'utf8').catch(() => null);
    if (script === null) return reply.code(404).send({ error: 'artifact unavailable' });
    return reply.type('text/plain; charset=utf-8').send(script);
  });
}
