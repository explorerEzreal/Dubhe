import os from 'node:os';

export type AgentPlatform = 'macos' | 'windows' | 'linux' | 'unknown';

export function normalizePlatform(platform: string): AgentPlatform {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

// 不调用外部命令，只采集 Node.js 可安全获取的本机资源快照。
export async function collectSystemMetrics(): Promise<Record<string, unknown>> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  return {
    hostname: os.hostname(),
    platform: normalizePlatform(os.platform()),
    osPlatform: os.platform(),
    arch: os.arch(),
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg(),
    },
    memory: {
      totalBytes: totalMemory,
      freeBytes: freeMemory,
      usedBytes: totalMemory - freeMemory,
    },
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
    },
  };
}
