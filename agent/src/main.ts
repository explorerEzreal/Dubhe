#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config/config.js';
import { createAgentRuntime } from './application/index.js';
import { createCloudClient, registerDevice } from './infrastructure/cloud/index.js';
import { loadCredentials, saveCredentials } from './infrastructure/credentials/index.js';
import { createLogger } from './infrastructure/logging/index.js';
import { createOllamaClient } from './infrastructure/ollama/index.js';
import { collectSystemMetrics } from './infrastructure/system/index.js';

// CLI 入口，统一接入配置、Ollama 与 Cloud 注册能力。
const program = new Command();

program
  .name('agent')
  .description('Local model platform agent')
  .version('0.1.0');

program
  .command('doctor')
  .description('Check local environment and configuration')
  .action(async () => {
    try {
      const config = loadConfig();
      console.log('[doctor] config loaded');
      console.log(`[doctor] CLOUD_URL=${config.CLOUD_URL}`);
      console.log(`[doctor] OLLAMA_URL=${config.OLLAMA_URL}`);
      console.log(`[doctor] MODELS=${config.MODELS || '(none)'}`);
      console.log(`[doctor] ollama=${await createOllamaClient(config.OLLAMA_URL).health() ? 'ok' : 'unavailable'}`);
      console.log('[doctor] done');
    } catch (err) {
      console.error(`[doctor] failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });

program
  .command('start')
  .description('Start the agent')
  .action(async () => {
    try {
      const config = loadConfig();
      const runtime = createAgentRuntime({
        config,
        ollama: createOllamaClient(config.OLLAMA_URL),
        logger: createLogger(config.LOG_LEVEL),
        collectMetrics: collectSystemMetrics,
        loadCredentials,
        saveCredentials,
        registerDevice,
        createCloudClient,
      });
      await runtime.start();

      let shuttingDown = false;
      const shutdown = async (): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        await runtime.stop();
      };
      process.once('SIGINT', () => void shutdown());
      process.once('SIGTERM', () => void shutdown());
    } catch {
      console.error('[start] 启动失败，请稍后重试');
      process.exitCode = 1;
    }
  });

program
  .command('register')
  .description('Register device with enrollment token')
  .requiredOption('-t, --token <token>')
  .action(async ({ token }: { token: string }) => {
    try {
      const config = loadConfig();
      const result = await registerDevice(config.CLOUD_URL, {
        token,
        deviceId: config.DEVICE_ID,
        name: config.AGENT_NAME,
        hardwareInfo: await collectSystemMetrics(),
      });
      await saveCredentials(config.CREDENTIALS_PATH, result);
      console.log(`[register] agent=${result.agentId}`);
    } catch {
      console.error('[register] 注册失败，请稍后重试');
      process.exitCode = 1;
    }
  });

program
  .command('models')
  .description('List local models')
  .action(async () => {
    try { const config=loadConfig(); (await createOllamaClient(config.OLLAMA_URL).listModels()).forEach((model)=>console.log(model)); }
    catch { console.error('[models] Ollama 不可用'); process.exitCode=1; }
  });

await program.parseAsync(process.argv);
