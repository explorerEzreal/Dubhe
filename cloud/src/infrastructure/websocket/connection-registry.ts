import type {
  ConnectionRegistry,
  ConnectionSocket,
} from '../../application/ports.js';

export class InMemoryConnectionRegistry implements ConnectionRegistry {
  private readonly sockets = new Map<string, { socket: ConnectionSocket; lastSeenAt: number }>();

  add(agentId: string, socket: ConnectionSocket): ConnectionSocket | undefined {
    const previous = this.sockets.get(agentId)?.socket;
    this.sockets.set(agentId, { socket, lastSeenAt: Date.now() });
    return previous;
  }

  remove(agentId: string, socket: ConnectionSocket): boolean {
    if (this.sockets.get(agentId)?.socket !== socket) return false;
    return this.sockets.delete(agentId);
  }

  closeAgent(agentId: string, code: number, reason: string): void {
    this.sockets.get(agentId)?.socket.close(code, reason);
  }

  get(agentId: string): ConnectionSocket | undefined {
    return this.sockets.get(agentId)?.socket;
  }

  touch(agentId: string, socket: ConnectionSocket, at = Date.now()): void {
    const entry = this.sockets.get(agentId);
    if (entry?.socket === socket) entry.lastSeenAt = at;
  }

  getStale(timeoutMs: number, now = Date.now()): Array<{ agentId: string; socket: ConnectionSocket }> {
    return Array.from(this.sockets.entries())
      .filter(([, entry]) => now - entry.lastSeenAt >= timeoutMs)
      .map(([agentId, entry]) => ({ agentId, socket: entry.socket }));
  }
}
