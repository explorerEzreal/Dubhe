import type { ConnectionRegistry } from '../../application/ports.js';
import type { AgentService } from '../../application/services/index.js';

interface HeartbeatMonitorLogger {
  warn(message: string): void;
}

// 监控单实例内存连接，并将超时状态同步到 PostgreSQL。
export class AgentHeartbeatMonitor {
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly connections: ConnectionRegistry,
    private readonly agents: AgentService,
    private readonly timeoutMs: number,
    private readonly logger: HeartbeatMonitorLogger,
    private readonly onAgentOffline?: (agentId: string) => void,
  ) {}

  start(): void {
    if (this.timer) return;
    const intervalMs = Math.max(1_000, Math.floor(this.timeoutMs / 2));
    this.timer = setInterval(() => void this.sweep(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async sweep(now = Date.now()): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const { agentId, socket } of this.connections.getStale(this.timeoutMs, now)) {
        if (!this.connections.remove(agentId, socket)) continue;
        this.onAgentOffline?.(agentId);
        socket.close(4000, 'heartbeat timeout');
        try {
          await this.agents.markOffline(agentId);
        } catch {
          this.logger.warn('agent timeout persistence failed');
        }
      }
    } finally {
      this.sweeping = false;
    }
  }
}
