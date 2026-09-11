#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config/config.js';
import {
  createAgentRuntime,
  normalizeCloudUrl,
  servicePaths,
  serviceStatus,
  startService,
  stopAndRemoveService,
  writeServiceConfig,
} from './application/index.js';
import { createCloudClient, registerDevice } from './infrastructure/cloud/index.js';
import { createInferenceBackend } from './infrastructure/backends/index.js';
import { loadCredentials, saveCredentials } from './infrastructure/credentials/index.js';
import { createLogger } from './infrastructure/logging/index.js';
import { collectSystemMetrics, normalizePlatform } from './infrastructure/system/index.js';
import { resolve } from 'node:path';

// CLI 入口，统一接入配置、推理后端与 Cloud 注册能力。
const program = new Command();

program
  .name('dubhe')
  .description('Dubhe 本地模型 Agent')
  .version('0.1.0');

function parseLaunchArgs(value: string, model: string, localUrl: string): NodeJS.ProcessEnv {
  const separator = value.indexOf('@');
  if (separator <= 0) throw new Error('启动参数必须为 <token>@<https-cloud>');
  const token = value.slice(0, separator);
  const cloudUrl = normalizeCloudUrl(value.slice(separator + 1));
  return {
    ...process.env,
    CLOUD_URL: cloudUrl,
    ENROLLMENT_TOKEN: token,
    MODELS: model,
    LOCAL_MODEL_URL: localUrl,
  };
}

async function startRuntime(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(env);
  const runtime = createAgentRuntime({
    config,
    backend: createInferenceBackend(config),
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
}

program
  .argument('[enrollment-cloud]')
  .argument('[model]')
  .argument('[local-model-url]')
  .action(async (enrollmentCloud?: string, model?: string, localModelUrl?: string) => {
    if (!enrollmentCloud && !model && !localModelUrl) {
      program.help();
      return;
    }
    if (!enrollmentCloud || !model || !localModelUrl) {
      console.error('用法: dubhe <token>@<https-cloud> <model> <local-model-url>');
      process.exitCode = 2;
      return;
    }
    try {
      await startRuntime(parseLaunchArgs(enrollmentCloud, model, localModelUrl));
    } catch {
      console.error('Agent 启动失败，请稍后重试');
      process.exitCode = 1;
    }
  });

program
  .command('doctor')
  .description('Check local environment and configuration')
  .action(async () => {
    try {
      const config = loadConfig();
      console.log('[doctor] config loaded');
      console.log(`[doctor] CLOUD_URL=${config.CLOUD_URL}`);
      console.log(`[doctor] platform=${normalizePlatform(process.platform)}`);
      console.log(`[doctor] local_url=${config.LOCAL_MODEL_URL}`);
      console.log(`[doctor] MODELS=${config.MODELS || '(none)'}`);
      console.log(`[doctor] backend=${await createInferenceBackend(config).health() ? 'ok' : 'unavailable'}`);
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
      await startRuntime();
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

const service = program.command('service').description('安装和管理常驻 Agent 服务');

service
  .command('install')
  .description('注册设备并安装常驻服务')
  .requiredOption('--cloud-url <url>', 'Cloud HTTPS/WSS 地址')
  .requiredOption('--token <token>', '一次性部署令牌')
  .requiredOption('--model <model>', '本地模型名称')
  .requiredOption('--local-url <url>', '本地 OpenAI 兼容服务地址')
  .option('--name <name>', 'Agent 名称', 'Dubhe Agent')
  .option('--device-id <id>', '设备 ID')
  .option('--credentials-path <path>', '凭证文件路径')
  .action(async (options: {
    cloudUrl: string;
    token: string;
    model: string;
    localUrl: string;
    name: string;
    deviceId?: string;
    credentialsPath?: string;
  }) => {
    try {
      const cloudUrl = normalizeCloudUrl(options.cloudUrl);
      const config = loadConfig({
        ...process.env,
        CLOUD_URL: cloudUrl,
        LOCAL_MODEL_URL: options.localUrl,
        MODELS: options.model,
        AGENT_NAME: options.name,
        DEVICE_ID: options.deviceId,
        CREDENTIALS_PATH: options.credentialsPath,
      });
      const credentialsPath = resolve(config.CREDENTIALS_PATH);
      const credentials = await registerDevice(cloudUrl, {
        token: options.token,
        deviceId: config.DEVICE_ID,
        name: config.AGENT_NAME,
        hardwareInfo: await collectSystemMetrics(),
      });
      await saveCredentials(credentialsPath, credentials);
      const paths = await writeServiceConfig({
        cloudUrl,
        localModelUrl: config.LOCAL_MODEL_URL,
        model: config.MODELS,
        agentName: config.AGENT_NAME,
        deviceId: credentials.deviceId,
        credentialsPath,
        logLevel: config.LOG_LEVEL,
      });
      await startService(paths);
      console.log(`[service] 已安装并启动，凭证路径=${credentialsPath}`);
    } catch {
      console.error('[service] 安装失败，请稍后重试');
      process.exitCode = 1;
    }
  });

service
  .command('status')
  .description('查看常驻服务状态')
  .action(async () => {
    try {
      servicePaths();
      console.log(`[service] ${await serviceStatus()}`);
    } catch {
      console.error('[service] 状态查询失败，请稍后重试');
      process.exitCode = 1;
    }
  });

service
  .command('uninstall')
  .description('停止并卸载常驻服务（保留凭证）')
  .action(async () => {
    try {
      await stopAndRemoveService(servicePaths());
      console.log('[service] 已卸载，凭证文件已保留');
    } catch {
      console.error('[service] 卸载失败，请稍后重试');
      process.exitCode = 1;
    }
  });

program
  .command('models')
  .description('List local models')
  .action(async () => {
    try {
      const config = loadConfig();
      (await createInferenceBackend(config).listModels()).forEach((model) => console.log(model));
    }
    catch { console.error('[models] 后端不可用'); process.exitCode=1; }
  });

await program.parseAsync(process.argv);
