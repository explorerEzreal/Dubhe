import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { loadConfig } from './config/config.js';
import { buildApp } from './bootstrap/build-app.js';
import { createLoggerOptions } from './infrastructure/logging/index.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const app = Fastify({
    logger: createLoggerOptions(config.LOG_LEVEL),
    trustProxy: config.TRUST_PROXY,
    bodyLimit: config.MAX_REQUEST_BODY_BYTES,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(','),
  });
  await app.register(helmet);
  await app.register(websocket);

  const pool = buildApp(app, config);

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
