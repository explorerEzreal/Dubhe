#!/usr/bin/env node
import { Command } from 'commander';
import { defaultCredentialsPath, loadConfig } from './config/config.js';
import {
  backupServiceConfig,
  createAgentRuntime,
  normalizeCloudUrl,
  readServiceConfig,
  removeServiceBackups,
  restartService,
  restoreServiceConfig,
  serviceLogs,
  servicePaths,
  serviceStatusObject,
  startService,
  stopAndRemoveService,
  stopService,
  writeServiceConfig,
} from './application/index.js';
import { createCloudClient, registerDevice } from './infrastructure/cloud/index.js';
import { createInferenceBackend } from './infrastructure/backends/index.js';
import { loadCredentials, saveCredentials } from './infrastructure/credentials/index.js';
import { createLogger } from './infrastructure/logging/index.js';
import { collectSystemMetrics, normalizePlatform } from './infrastructure/system/index.js';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';

const VERSION = '0.1.0';
const PROTOCOL_VERSION = 1;
const program = new Command().name('dubhe').description('Bubhe 天枢本地模型 Agent').version(VERSION);
const paths = (): ReturnType<typeof servicePaths> => servicePaths();

async function collectAgentMetrics(): Promise<Record<string, unknown>> {
  return { ...(await collectSystemMetrics()), agentVersion: VERSION, protocolVersion: PROTOCOL_VERSION };
}

async function startRuntime(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(env);
  const runtime = createAgentRuntime({
    config,
    backend: createInferenceBackend(config),
    logger: createLogger(config.LOG_LEVEL),
    collectMetrics: collectAgentMetrics,
    loadCredentials,
    saveCredentials,
    registerDevice,
    createCloudClient,
  });
  await runtime.start();
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await runtime.stop();
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

async function requireInstalled(): Promise<void> {
  if ((await serviceStatusObject()).status === 'not-installed') {
    process.exitCode = 3;
    throw new Error('服务未安装，请先执行 dubhe service install');
  }
}

function endpoint(host: string, port: number): string {
  return `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`;
}

function validateHost(host: string): string {
  const value = host.trim();
  if (!value || value.includes('://') || value.includes('/') || /\s/.test(value)) {
    throw new Error('主机参数必须是不含协议、路径和空格的主机名或 IP');
  }
  return value;
}

function validatePort(value: string | number): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须是 1 到 65535 的整数');
  return port;
}

function configuredEndpoint(config: Record<string, string>): { host: string; port: number } {
  if (config.LOCAL_MODEL_HOST && config.LOCAL_MODEL_PORT) {
    return { host: config.LOCAL_MODEL_HOST, port: Number(config.LOCAL_MODEL_PORT) };
  }
  const url = new URL(config.LOCAL_MODEL_URL ?? 'http://127.0.0.1:8000');
  return { host: url.hostname, port: Number(url.port || 80) };
}

program.command('run').description('内部：前台运行 Agent runtime').action(async () => {
  try { await startRuntime(); } catch { console.error('[run] Agent 启动失败，请稍后重试'); process.exitCode = 1; }
});

program.command('start').description('启动常驻 Agent 服务').action(async () => {
  try { await requireInstalled(); await startService(paths()); console.log('[service] Agent 已启动'); }
  catch (error) { console.error(`[service] 启动失败: ${error instanceof Error ? error.message : '请稍后重试'}`); if (process.exitCode !== 3) process.exitCode = 1; }
});

program.command('stop').description('停止常驻 Agent 服务').action(async () => {
  try { await requireInstalled(); await stopService(paths()); console.log('[service] Agent 已停止'); }
  catch (error) { console.error(`[service] 停止失败: ${error instanceof Error ? error.message : '请稍后重试'}`); if (process.exitCode !== 3) process.exitCode = 1; }
});

program.command('restart').description('重启常驻 Agent 服务').action(async () => {
  try { await restartService(paths()); console.log('[service] Agent 已重启'); }
  catch (error) { console.error(`[service] 重启失败: ${error instanceof Error ? error.message : '请稍后重试'}`); process.exitCode = error instanceof Error && error.message.includes('未安装') ? 3 : 1; }
});

program.command('status').description('查看服务、模型和端口状态').option('--json', '输出 JSON').action(async ({ json }: { json?: boolean }) => {
  const result = await serviceStatusObject();
  if (json) console.log(JSON.stringify({ status: result.status, model: result.model, host: result.host, port: result.port, local_url: result.localUrl, agent_version: result.agentVersion, platform: result.platform, service: result.service, pid: result.pid }));
  else console.log(`status=${result.status}\nmodel=${result.model ?? '-'}\nhost=${result.host ?? '-'}\nport=${result.port ?? '-'}\nlocal_url=${result.localUrl ?? '-'}\nagent_version=${result.agentVersion}\nplatform=${result.platform}\nservice=${result.service}\npid=${result.pid ?? '-'}`);
});

program.command('logs').description('查看 Agent 日志').option('--follow', '持续跟踪').option('-n, --lines <number>', '显示行数', '50').action(async ({ follow, lines }: { follow?: boolean; lines: string }) => {
  try { await serviceLogs(Number(lines), follow); } catch { console.error('[logs] 日志读取失败，请稍后重试'); process.exitCode = 1; }
});

program.command('doctor').description('检查本地环境和 Cloud 配置').option('--json', '输出 JSON').action(async ({ json }: { json?: boolean }) => {
  try {
    const configured: Record<string, string> = await readServiceConfig();
    const config = loadConfig({ ...process.env, ...configured });
    const result = { status: (await serviceStatusObject()).status, platform: normalizePlatform(process.platform), cloudUrl: config.CLOUD_URL, model: config.MODELS, localUrl: config.LOCAL_MODEL_URL, backend: await createInferenceBackend(config).health() ? 'ok' : 'unavailable' };
    if (json) console.log(JSON.stringify(result)); else console.log(`[doctor] service=${result.status}\n[doctor] CLOUD_URL=${result.cloudUrl}\n[doctor] model=${result.model}\n[doctor] local_url=${result.localUrl}\n[doctor] backend=${result.backend}`);
    if (result.backend !== 'ok') process.exitCode = 1;
  } catch { console.error('[doctor] 检查失败，请先安装服务或检查配置'); process.exitCode = 1; }
});

program.command('models').description('列出本地模型').action(async () => {
  try { const config = loadConfig({ ...process.env, ...(await readServiceConfig()) }); (await createInferenceBackend(config).listModels()).forEach((model) => console.log(model)); }
  catch { console.error('[models] 请求失败，请稍后重试'); process.exitCode = 1; }
});

program.command('version').description('显示 Agent 版本').action(() => console.log(VERSION));

const configCommand = program.command('config').description('管理本地 Agent 配置');
configCommand.command('show').description('显示脱敏配置').option('--json', '输出 JSON').action(async ({ json }: { json?: boolean }) => {
  try {
    const configured = await readServiceConfig();
    const credentialPath = configured.CREDENTIALS_PATH;
    const credentials = credentialPath ? await access(resolve(credentialPath)).then(() => true).catch(() => false) : false;
    const result = { cloudUrl: configured.CLOUD_URL ?? null, model: configured.MODELS ?? null, host: configured.LOCAL_MODEL_HOST ?? null, port: configured.LOCAL_MODEL_PORT ? Number(configured.LOCAL_MODEL_PORT) : null, localUrl: configured.LOCAL_MODEL_URL ?? null, agentName: configured.AGENT_NAME ?? null, credentials, status: (await serviceStatusObject()).status, agentVersion: VERSION };
    if (json) console.log(JSON.stringify(result)); else Object.entries(result).forEach(([key, value]) => console.log(`${key}=${value ?? '-'}`));
  } catch { console.error('[config] 读取失败，请稍后重试'); process.exitCode = 1; }
});
configCommand.command('set').description('设置模型、主机或端口').option('--model <model>', '模型名称').option('--host <host>', '本地主机').option('--port <port>', '本地端口').action(async (options: { model?: string; host?: string; port?: string }) => {
  let backup: Awaited<ReturnType<typeof backupServiceConfig>> | undefined;
  try {
    await requireInstalled();
    if (!options.model && !options.host && !options.port) throw new Error('至少提供 --model、--host 或 --port 之一');
    const current: Record<string, string> = await readServiceConfig();
    const model = options.model ?? current.MODELS;
    const host = validateHost(options.host ?? current.LOCAL_MODEL_HOST ?? '127.0.0.1');
    const port = validatePort(options.port ?? current.LOCAL_MODEL_PORT ?? 8000);
    if (!model) throw new Error('模型参数无效');
    const config = loadConfig({ ...process.env, ...current, MODELS: model, LOCAL_MODEL_HOST: host, LOCAL_MODEL_PORT: String(port), LOCAL_MODEL_URL: endpoint(host, port) });
    backup = await backupServiceConfig(paths());
    await stopService(paths());
    await writeServiceConfig({ cloudUrl: config.CLOUD_URL, host, port, model, agentName: config.AGENT_NAME, deviceId: config.DEVICE_ID, credentialsPath: resolve(config.CREDENTIALS_PATH), logLevel: config.LOG_LEVEL });
    await startService(paths());
    console.log(`[config] 已更新 model=${model} host=${host} port=${port}`);
  } catch (error) {
    if (backup) {
      try { await restoreServiceConfig(paths(), backup); await startService(paths()); } catch { /* 保留原始错误 */ }
    }
    console.error(`[config] 更新失败: ${error instanceof Error ? error.message : '请稍后重试'}`);
    process.exitCode = 1;
  }
});

const service = program.command('service').description('安装、迁移和重置 Agent 服务');
service.command('install').description('首次注册或复用凭证安装服务').requiredOption('--cloud-url <url>').requiredOption('--model <model>').requiredOption('--port <port>').option('--host <host>', '本地主机', '127.0.0.1').option('--token <token>', '首次注册令牌').option('--name <name>', 'Agent 名称', 'Bubhe 天枢 Agent').option('--device-id <id>').option('--credentials-path <path>').action(async (options: { cloudUrl: string; model: string; port: string; host: string; token?: string; name: string; deviceId?: string; credentialsPath?: string }) => {
  try {
    const cloudUrl = normalizeCloudUrl(options.cloudUrl);
    const host = validateHost(options.host);
    const port = validatePort(options.port);
    const current: Record<string, string> = await readServiceConfig().catch(() => ({}));
    const config = loadConfig({ ...process.env, ...current, CLOUD_URL: cloudUrl, MODELS: options.model, LOCAL_MODEL_HOST: host, LOCAL_MODEL_PORT: String(port), LOCAL_MODEL_URL: endpoint(host, port), AGENT_NAME: options.name, DEVICE_ID: options.deviceId ?? current.DEVICE_ID, CREDENTIALS_PATH: options.credentialsPath ?? current.CREDENTIALS_PATH });
    const credentialsPath = resolve(config.CREDENTIALS_PATH);
    let credentials = await loadCredentials(credentialsPath);
    if (!credentials.credential) {
      if (!options.token) throw new Error('首次安装没有本地凭证，必须提供 --token');
      credentials = await registerDevice(cloudUrl, { token: options.token, deviceId: config.DEVICE_ID, name: config.AGENT_NAME, hardwareInfo: await collectAgentMetrics() });
      await saveCredentials(credentialsPath, credentials);
    }
    await stopService(paths());
    const servicePathsValue = await writeServiceConfig({ cloudUrl, host, port, model: options.model, agentName: config.AGENT_NAME, deviceId: credentials.deviceId, credentialsPath, logLevel: config.LOG_LEVEL });
    await startService(servicePathsValue);
    console.log(`[service] 已安装并启动 model=${options.model} host=${host} port=${port}`);
  } catch (error) { console.error(`[service] 安装失败: ${error instanceof Error ? error.message : '请稍后重试'}`); process.exitCode = 1; }
});
service.command('migrate').description('迁移当前版本服务配置').action(async () => {
  const servicePathsValue = paths();
  let backup: Awaited<ReturnType<typeof backupServiceConfig>> | undefined;
  try {
    await access(servicePathsValue.servicePath);
    backup = await backupServiceConfig(servicePathsValue);
    const current: Record<string, string> = await readServiceConfig(servicePathsValue);
    const local = configuredEndpoint(current);
    const config = loadConfig({ ...process.env, ...current, LOCAL_MODEL_HOST: local.host, LOCAL_MODEL_PORT: String(local.port), LOCAL_MODEL_URL: endpoint(local.host, local.port) });
    await stopService(servicePathsValue);
    await writeServiceConfig({ cloudUrl: config.CLOUD_URL, host: local.host, port: local.port, model: config.MODELS, agentName: config.AGENT_NAME, deviceId: config.DEVICE_ID, credentialsPath: resolve(config.CREDENTIALS_PATH), logLevel: config.LOG_LEVEL });
    await startService(servicePathsValue);
    console.log(`[service] 迁移完成 backup=${backup.servicePath}`);
  } catch (error) {
    if (backup) {
      try { await restoreServiceConfig(servicePathsValue, backup); await startService(servicePathsValue); } catch { /* 回滚失败由日志与状态命令继续诊断 */ }
    }
    console.error(`[service] 迁移失败: ${error instanceof Error ? error.message : '请稍后重试'}`);
    process.exitCode = 1;
  }
});
service.command('reset').description('删除服务配置和设备凭证').requiredOption('--yes', '确认删除').action(async () => {
  try { const configured: Record<string, string> = await readServiceConfig().catch(() => ({})); await stopAndRemoveService(paths()); await removeServiceBackups(paths()); const credentialsPath = resolve(configured.CREDENTIALS_PATH ?? defaultCredentialsPath()); await import('node:fs/promises').then(({ rm }) => rm(credentialsPath, { force: true })); console.log('[service] 已重置，凭证和服务配置已删除'); }
  catch { console.error('[service] 重置失败，请稍后重试'); process.exitCode = 1; }
});

await program.parseAsync(process.argv);
