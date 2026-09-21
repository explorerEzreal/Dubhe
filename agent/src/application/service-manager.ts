import { access, chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ServiceConfig {
  cloudUrl: string;
  host: string;
  port: number;
  model: string;
  agentName: string;
  deviceId?: string;
  credentialsPath: string;
  logLevel: string;
}

export interface ServicePaths {
  envPath: string;
  servicePath: string;
}

export interface ServiceBackup {
  envPath: string;
  servicePath: string;
}

export interface ServiceStatus {
  status: 'running' | 'stopped' | 'degraded' | 'not-installed' | 'unknown';
  platform: 'darwin' | 'linux';
  service: string;
  pid: number | null;
  model: string | null;
  host: string | null;
  port: number | null;
  localUrl: string | null;
  agentVersion: string;
}

const AGENT_VERSION = '1.0.0-beta.0';

function localModelUrl(host: string, port: number): string {
  return `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`;
}

function homePath(...parts: string[]): string {
  return join(os.homedir(), ...parts);
}

export function normalizeCloudUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
    throw new Error('Cloud 地址必须使用 https://、wss://，本地开发可使用 http:// 或 ws://');
  }
  url.pathname = url.pathname.replace(/\/$/, '').endsWith('/agent')
    ? url.pathname.replace(/\/$/, '')
    : `${url.pathname.replace(/\/$/, '')}/agent`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function servicePaths(platform: NodeJS.Platform = process.platform): ServicePaths {
  if (platform === 'darwin') {
    const base = homePath('Library', 'Application Support', 'Dubhe Agent');
    return { envPath: join(base, 'agent.env'), servicePath: homePath('Library', 'LaunchAgents', 'com.dubhe.agent.plist') };
  }
  if (platform === 'linux') {
    const base = join(process.env.XDG_CONFIG_HOME ?? homePath('.config'), 'dubhe-agent');
    return { envPath: join(base, 'agent.env'), servicePath: join(process.env.XDG_CONFIG_HOME ?? homePath('.config'), 'systemd', 'user', 'dubhe-agent.service') };
  }
  throw new Error('仅支持 Linux systemd 和 macOS launchd');
}

function envValue(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function entryPath(): string {
  return resolve(process.argv[1] ?? join(import.meta.dirname ?? '.', 'main.js'));
}

function systemdUnit(config: ServiceConfig, paths: ServicePaths): string {
  const node = JSON.stringify(process.execPath);
  const entry = JSON.stringify(entryPath());
  return `[Unit]
Description=Bubhe 天枢 Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${paths.envPath}
ExecStart=${node} ${entry} run
WorkingDirectory=${dirname(config.credentialsPath)}
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${dirname(config.credentialsPath)} ${dirname(paths.envPath)}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`;
}

function plist(config: ServiceConfig): string {
  const env = [
    ['CLOUD_URL', config.cloudUrl],
    ['LOCAL_MODEL_HOST', config.host],
    ['LOCAL_MODEL_PORT', String(config.port)],
    ['LOCAL_MODEL_URL', localModelUrl(config.host, config.port)],
    ['MODELS', config.model],
    ['AGENT_NAME', config.agentName],
    ['CREDENTIALS_PATH', config.credentialsPath],
    ['LOG_LEVEL', config.logLevel],
    ...(config.deviceId ? [['DEVICE_ID', config.deviceId]] : []),
  ];
  const environment = env.map(([key, value]) => `    <key>${key}</key>\n    <string>${xml(value)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.dubhe.agent</string>
  <key>ProgramArguments</key>
  <array><string>${xml(process.execPath)}</string><string>${xml(entryPath())}</string><string>run</string></array>
  <key>EnvironmentVariables</key>
  <dict>
${environment}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${xml(homePath('Library', 'Logs', 'dubhe-agent.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(homePath('Library', 'Logs', 'dubhe-agent.error.log'))}</string>
</dict>
</plist>
`;
}

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export async function writeServiceConfig(config: ServiceConfig): Promise<ServicePaths> {
  const paths = servicePaths();
  await mkdir(dirname(paths.envPath), { recursive: true, mode: 0o700 });
  await mkdir(dirname(paths.servicePath), { recursive: true, mode: 0o700 });
  await mkdir(dirname(config.credentialsPath), { recursive: true, mode: 0o700 });
  const env = [
    `CLOUD_URL=${envValue(config.cloudUrl)}`,
    `LOCAL_MODEL_HOST=${envValue(config.host)}`,
    `LOCAL_MODEL_PORT=${envValue(String(config.port))}`,
    `LOCAL_MODEL_URL=${envValue(localModelUrl(config.host, config.port))}`,
    `MODELS=${envValue(config.model)}`,
    `AGENT_NAME=${envValue(config.agentName)}`,
    `CREDENTIALS_PATH=${envValue(config.credentialsPath)}`,
    `LOG_LEVEL=${envValue(config.logLevel)}`,
    ...(config.deviceId ? [`DEVICE_ID=${envValue(config.deviceId)}`] : []),
  ].join('\n') + '\n';
  await writeFile(paths.envPath, env, { mode: 0o600 });
  await chmod(paths.envPath, 0o600);
  await writeFile(paths.servicePath, process.platform === 'darwin' ? plist(config) : systemdUnit(config, paths), { mode: 0o600 });
  await chmod(paths.servicePath, 0o600);
  return paths;
}

export async function startService(paths: ServicePaths): Promise<void> {
  if (process.platform === 'darwin') {
    await assertServiceInstalled(paths);
    if ((await serviceStatusObject(paths)).status === 'running') return;
    if (await isDarwinLoaded()) {
      await execFileAsync('launchctl', ['kickstart', `gui/${process.getuid?.() ?? 0}/com.dubhe.agent`]);
    } else {
      await execFileAsync('launchctl', ['load', '-w', paths.servicePath]);
    }
    return;
  }
  await assertServiceInstalled(paths);
  await execFileAsync('systemctl', ['--user', 'daemon-reload']);
  await execFileAsync('systemctl', ['--user', 'enable', '--now', 'dubhe-agent.service']);
}

async function assertServiceInstalled(paths: ServicePaths): Promise<void> {
  try { await access(paths.servicePath); } catch { throw new Error('服务未安装'); }
}

async function isDarwinLoaded(): Promise<boolean> {
  try {
    await execFileAsync('launchctl', ['print', `gui/${process.getuid?.() ?? 0}/com.dubhe.agent`]);
    return true;
  } catch { return false; }
}

export async function stopService(paths: ServicePaths): Promise<void> {
  try { await access(paths.servicePath); } catch { return; }
  if (process.platform === 'darwin') {
    if (!(await isDarwinLoaded())) return;
    try { await execFileAsync('launchctl', ['bootout', `gui/${process.getuid?.() ?? 0}/com.dubhe.agent`]); } catch { /* 已停止 */ }
    return;
  }
  try { await execFileAsync('systemctl', ['--user', 'stop', 'dubhe-agent.service']); } catch { /* 已停止或未安装 */ }
}

export async function restartService(paths: ServicePaths): Promise<void> {
  await assertServiceInstalled(paths);
  if (process.platform === 'darwin') {
    if (await isDarwinLoaded()) {
      await execFileAsync('launchctl', ['kickstart', '-k', `gui/${process.getuid?.() ?? 0}/com.dubhe.agent`]);
    } else {
      await execFileAsync('launchctl', ['load', '-w', paths.servicePath]);
    }
    return;
  }
  await execFileAsync('systemctl', ['--user', 'restart', 'dubhe-agent.service']);
}

export async function serviceStatusObject(paths: ServicePaths = servicePaths()): Promise<ServiceStatus> {
  const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
  const configured: Record<string, string> = await readServiceConfig(paths).catch(() => ({}));
  const model = configured.MODELS ?? null;
  const legacyUrl = configured.LOCAL_MODEL_URL ? new URL(configured.LOCAL_MODEL_URL) : null;
  const host = configured.LOCAL_MODEL_HOST ?? legacyUrl?.hostname ?? null;
  const port = configured.LOCAL_MODEL_PORT ? Number(configured.LOCAL_MODEL_PORT) : legacyUrl ? Number(legacyUrl.port || 80) : null;
  const localUrl = host && port ? localModelUrl(host, port) : null;
  const base = { model, host, port, localUrl, agentVersion: AGENT_VERSION };
  try { await access(paths.servicePath); } catch {
    return { ...base, status: 'not-installed', platform, service: platform === 'darwin' ? 'com.dubhe.agent' : 'dubhe-agent.service', pid: null };
  }
  if (process.platform === 'darwin') {
    try {
      const result = await execFileAsync('launchctl', ['print', `gui/${process.getuid?.() ?? 0}/com.dubhe.agent`]);
      const pid = result.stdout.match(/\bpid\s*=\s*(\d+)/)?.[1];
      const state = result.stdout.match(/\bstate\s*=\s*([^\n]+)/)?.[1]?.trim();
      const failed = /last exit code\s*=\s*[1-9]\d*/.test(result.stdout);
      return {
        ...base,
        status: state === 'running' ? 'running' : failed ? 'degraded' : 'stopped',
        platform,
        service: 'com.dubhe.agent',
        pid: pid ? Number(pid) : null,
      };
    } catch {
      return { ...base, status: 'stopped', platform, service: 'com.dubhe.agent', pid: null };
    }
  }
  try {
    const result = await execFileAsync('systemctl', ['--user', 'show', 'dubhe-agent.service', '--property=ActiveState,MainPID', '--value']);
    const [state, pid] = result.stdout.trim().split('\n');
    return { ...base, status: state === 'active' ? 'running' : state === 'failed' ? 'degraded' : 'stopped', platform, service: 'dubhe-agent.service', pid: pid && pid !== '0' ? Number(pid) : null };
  } catch {
    return { ...base, status: 'unknown', platform, service: 'dubhe-agent.service', pid: null };
  }
}

export async function serviceStatus(): Promise<string> {
  return (await serviceStatusObject()).status;
}

export async function readServiceConfig(paths: ServicePaths = servicePaths()): Promise<Record<string, string>> {
  const content = await readFile(paths.envPath, 'utf8');
  return Object.fromEntries(content.split('\n').filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).replace(/^'/, '').replace(/'$/, '').replaceAll("'\\''", "'")];
  }));
}

export async function serviceLogs(lines = 50, follow = false): Promise<void> {
  const args = process.platform === 'darwin'
    ? ['-n', String(lines), ...(follow ? ['-f'] : []), `${os.homedir()}/Library/Logs/dubhe-agent.log`]
    : ['--user', '-u', 'dubhe-agent.service', '-n', String(lines), ...(follow ? ['-f'] : []), '--no-pager'];
  const command = process.platform === 'darwin' ? 'tail' : 'journalctl';
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error('日志读取失败')));
  });
}

export async function stopAndRemoveService(paths: ServicePaths): Promise<void> {
  if (process.platform === 'darwin') {
    try { await execFileAsync('launchctl', ['unload', '-w', paths.servicePath]); } catch { /* 服务可能尚未加载 */ }
  } else {
    try { await execFileAsync('systemctl', ['--user', 'disable', '--now', 'dubhe-agent.service']); } catch { /* 服务可能尚未加载 */ }
    try { await execFileAsync('systemctl', ['--user', 'daemon-reload']); } catch { /* systemd 可能不可用 */ }
  }
  await rm(paths.servicePath, { force: true });
  await rm(paths.envPath, { force: true });
}

export async function backupServiceConfig(paths: ServicePaths): Promise<ServiceBackup> {
  const suffix = `.backup-${Date.now()}`;
  const backup = { servicePath: `${paths.servicePath}${suffix}`, envPath: `${paths.envPath}${suffix}` };
  await cp(paths.servicePath, backup.servicePath);
  await cp(paths.envPath, backup.envPath);
  return backup;
}

export async function restoreServiceConfig(paths: ServicePaths, backup: ServiceBackup): Promise<void> {
  await cp(backup.servicePath, paths.servicePath);
  await cp(backup.envPath, paths.envPath);
}

export async function removeServiceBackups(paths: ServicePaths): Promise<void> {
  const directories = [dirname(paths.servicePath), dirname(paths.envPath)];
  const { readdir } = await import('node:fs/promises');
  for (const directory of new Set(directories)) {
    const names = await readdir(directory).catch(() => []);
    for (const name of names) {
      if (name.startsWith(`${paths.servicePath.split('/').pop()}.backup-`) || name.startsWith(`${paths.envPath.split('/').pop()}.backup-`)) {
        await rm(join(directory, name), { force: true });
      }
    }
  }
}
