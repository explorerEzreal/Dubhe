import fs from 'node:fs/promises';
import os from 'node:os';

export type AgentPlatform = 'macos' | 'windows' | 'linux' | 'unknown';

export function normalizePlatform(platform: string): AgentPlatform {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

let previousNetwork: { rxBytes: number; txBytes: number; at: number } | null = null;

async function collectDiskMetrics(): Promise<Record<string, unknown> | null> {
  try {
    const target = process.cwd();
    const stats = await fs.statfs(target);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    if (!Number.isFinite(totalBytes) || !Number.isFinite(freeBytes) || totalBytes <= 0) return null;
    return {
      mount: target,
      totalBytes,
      freeBytes,
      usedBytes: Math.max(0, totalBytes - freeBytes),
      usagePercent: Math.round(((totalBytes - freeBytes) / totalBytes) * 100),
    };
  } catch {
    return null;
  }
}

async function collectLinuxNetworkMetrics(): Promise<Record<string, unknown> | null> {
  if (os.platform() !== 'linux') return null;
  try {
    const content = await fs.readFile('/proc/net/dev', 'utf8');
    let rxBytes = 0;
    let txBytes = 0;
    for (const line of content.split('\n').slice(2)) {
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      const name = line.slice(0, separator).trim();
      if (name === 'lo') continue;
      const values = line.slice(separator + 1).trim().split(/\s+/).map(Number);
      if (values.length >= 9) {
        rxBytes += values[0] || 0;
        txBytes += values[8] || 0;
      }
    }
    if (!Number.isFinite(rxBytes) || !Number.isFinite(txBytes)) return null;
    const now = Date.now();
    const elapsed = previousNetwork ? (now - previousNetwork.at) / 1000 : 0;
    const result = {
      rxBytes,
      txBytes,
      rxBytesPerSecond: previousNetwork && elapsed > 0 ? Math.max(0, (rxBytes - previousNetwork.rxBytes) / elapsed) : null,
      txBytesPerSecond: previousNetwork && elapsed > 0 ? Math.max(0, (txBytes - previousNetwork.txBytes) / elapsed) : null,
    };
    previousNetwork = { rxBytes, txBytes, at: now };
    return result;
  } catch {
    return null;
  }
}

// 不调用外部命令，只采集 Node.js 可安全获取的本机资源快照。
export async function collectSystemMetrics(): Promise<Record<string, unknown>> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  const [disk, network] = await Promise.all([
    collectDiskMetrics(),
    collectLinuxNetworkMetrics(),
  ]);
  return {
    hostname: os.hostname(),
    platform: normalizePlatform(os.platform()),
    osPlatform: os.platform(),
    arch: os.arch(),
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg(),
      usagePercent: null,
    },
    memory: {
      totalBytes: totalMemory,
      freeBytes: freeMemory,
      usedBytes: totalMemory - freeMemory,
      usagePercent: totalMemory > 0 ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : null,
    },
    gpu: null,
    disk,
    network,
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
    },
  };
}
