import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

export interface AgentDownloadOptions {
  releaseDir: string;
  releaseVersion: string;
  downloadBaseUrl: string;
}

// 提供安装脚本、版本清单和受限的 Agent 制品下载。
export function registerDownloadRoutes(
  app: FastifyInstance,
  options: AgentDownloadOptions,
): void {
  const root = resolve(options.releaseDir);
  const artifact = `dubhe-agent-${options.releaseVersion}-linux-x86_64.tar.gz`;

  app.get('/downloads/agent/install.sh', async (_request, reply) => {
    const script = await readFile(resolve(root, 'install.sh'), 'utf8').catch(() => null);
    if (script === null) return reply.code(404).send({ error: 'artifact unavailable' });
    return reply.type('text/plain; charset=utf-8').send(script);
  });

  app.get('/downloads/agent/manifest.json', async (_request, reply) => {
    const manifest = await readFile(resolve(root, 'manifest.json'), 'utf8').catch(() => null);
    if (manifest === null) return reply.code(404).send({ error: 'artifact unavailable' });
    return reply.type('application/json; charset=utf-8').send(manifest);
  });

  app.get<{ Params: { artifact: string } }>('/downloads/agent/:artifact', async (request, reply) => {
    if (basename(request.params.artifact) !== request.params.artifact) {
      return reply.code(400).send({ error: 'invalid artifact' });
    }
    const requested = request.params.artifact === artifact ? artifact : request.params.artifact;
    if (!/^dubhe-agent-[A-Za-z0-9._-]+\.tar\.gz$/.test(requested)) {
      return reply.code(404).send({ error: 'artifact unavailable' });
    }
    const file = await readFile(resolve(root, requested)).catch(() => null);
    if (file === null) return reply.code(404).send({ error: 'artifact unavailable' });
    return reply.type('application/gzip').send(file);
  });
}
