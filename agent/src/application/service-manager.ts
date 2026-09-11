import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ServiceConfig {
  cloudUrl: string;
  localModelUrl: string;
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

function homePath(...parts: string[]): string {
  return join(os.homedir(), ...parts);
}

export function normalizeCloudUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol !== 'wss:') throw new Error('Cloud 地址必须使用 https:// 或 wss://');
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
Description=Dubhe Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${paths.envPath}
ExecStart=${node} ${entry} start
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
    ['LOCAL_MODEL_URL', config.localModelUrl],
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
  <array><string>${xml(process.execPath)}</string><string>${xml(entryPath())}</string><string>start</string></array>
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
    `LOCAL_MODEL_URL=${envValue(config.localModelUrl)}`,
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
    await execFileAsync('launchctl', ['load', '-w', paths.servicePath]);
    return;
  }
  await execFileAsync('systemctl', ['--user', 'daemon-reload']);
  await execFileAsync('systemctl', ['--user', 'enable', '--now', 'dubhe-agent.service']);
}

export async function serviceStatus(): Promise<string> {
  if (process.platform === 'darwin') {
    try {
      const result = await execFileAsync('launchctl', ['print', `gui/${process.getuid?.() ?? 0}/com.dubhe.agent`]);
      return result.stdout.trim() || 'active';
    } catch {
      return 'inactive';
    }
  }
  try {
    const result = await execFileAsync('systemctl', ['--user', 'is-active', 'dubhe-agent.service']);
    return result.stdout.trim() || 'unknown';
  } catch {
    return 'inactive';
  }
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
