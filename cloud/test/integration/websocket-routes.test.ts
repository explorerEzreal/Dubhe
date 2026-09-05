import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type {
  ConnectionRegistry,
  ConnectionSocket,
} from '../../src/application/ports.js';
import type { AgentService } from '../../src/application/services/index.js';
import {
  AgentHeartbeatMonitor,
  InMemoryConnectionRegistry,
} from '../../src/infrastructure/websocket/index.js';
import { createAgentConnectionHandler } from '../../src/interfaces/websocket/index.js';

class FakeSocket extends EventEmitter implements ConnectionSocket {
  readonly sent: string[] = [];
  readonly closed: Array<{ code?: number; reason?: string }> = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed.push({ code, reason });
  }

  emitMessage(value: unknown): void {
    this.emit('message', Buffer.from(JSON.stringify(value)));
  }
}

class FakeConnections implements ConnectionRegistry {
  readonly agents = new Map<string, ConnectionSocket>();

  add(agentId: string, socket: ConnectionSocket): ConnectionSocket | undefined {
    const previous = this.agents.get(agentId);
    this.agents.set(agentId, socket);
    return previous;
  }

  remove(agentId: string, socket: ConnectionSocket): boolean {
    if (this.agents.get(agentId) !== socket) return false;
    this.agents.delete(agentId);
    return true;
  }

  closeAgent(): void {}

  get(agentId: string): ConnectionSocket | undefined {
    return this.agents.get(agentId);
  }

  touch(): void {}

  getStale(): Array<{ agentId: string; socket: ConnectionSocket }> {
    return [];
  }
}

function message(type: string, payload: Record<string, unknown>) {
  return {
    protocol_version: 1,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function createService(overrides: {
  heartbeat?: (agentId: string, input: unknown) => Promise<void>;
  markOffline?: (agentId: string) => Promise<void>;
} = {}) {
  return {
    authenticateCredential: async (credential: string) => {
      if (credential !== 'valid') throw new Error('invalid');
      return { id: 'agent-1', userId: 'user-1', status: 'online' };
    },
    register: async () => ({ agentId: 'agent-1', credential: 'new-secret' }),
    heartbeat: async () => undefined,
    markOffline: async () => undefined,
    ...overrides,
  } as unknown as AgentService;
}

function request(credential = '', encrypted = true) {
  return {
    headers: credential ? { authorization: `Bearer ${credential}` } : {},
    protocol: encrypted ? 'https' : 'http',
    raw: { socket: { encrypted } },
  };
}

describe('Agent WSS routes', () => {
  it('rejects a non-TLS connection before processing credentials', () => {
    const socket = new FakeSocket();
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      {
        path: '/agent',
        requireTls: true,
        maxMessageBytes: 1_048_576,
        service: createService(),
        connections: new FakeConnections(),
      },
    );
    handler(socket, request('', false) as never);
    expect(socket.closed).toEqual([{ code: 1008, reason: 'tls required' }]);
  });

  it('registers once and returns a protocol v1 credential', async () => {
    const socket = new FakeSocket();
    const connections = new FakeConnections();
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      {
        path: '/agent',
        requireTls: true,
        maxMessageBytes: 1_048_576,
        service: createService(),
        connections,
      },
    );
    handler(socket, request() as never);
    socket.emitMessage(
      message('register', {
        token: 'enrollment',
        deviceId: 'device-1',
        name: 'Agent',
      }),
    );
    await tick();
    expect(connections.agents.has('agent-1')).toBe(true);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      protocol_version: 1,
      type: 'registered',
      payload: { agentId: 'agent-1', credential: 'new-secret' },
    });
  });

  it('authenticates credentials, validates heartbeat and removes closed connections', async () => {
    const socket = new FakeSocket();
    const connections = new FakeConnections();
    const offlineAgentIds: string[] = [];
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      {
        path: '/agent',
        requireTls: true,
        maxMessageBytes: 1_048_576,
        service: createService({
          markOffline: async (agentId) => {
            offlineAgentIds.push(agentId);
          },
        }),
        connections,
      },
    );
    handler(socket, request('valid') as never);
    await tick();
    socket.emitMessage(
      message('heartbeat', {
        status: 'online',
        models: [{ name: 'llama3:8b', state: 'ready' }],
      }),
    );
    await tick();
    expect(JSON.parse(socket.sent[0])).toMatchObject({ type: 'heartbeat_ack' });
    socket.emit('close');
    await tick();
    expect(connections.agents.has('agent-1')).toBe(false);
    expect(offlineAgentIds).toEqual(['agent-1']);
  });

  it('replaces an old connection without taking the new connection offline', async () => {
    const first = new FakeSocket();
    const second = new FakeSocket();
    const connections = new FakeConnections();
    const offlineAgentIds: string[] = [];
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      {
        path: '/agent',
        requireTls: true,
        maxMessageBytes: 1_048_576,
        service: createService({
          markOffline: async (agentId) => {
            offlineAgentIds.push(agentId);
          },
        }),
        connections,
      },
    );

    handler(first, request('valid') as never);
    await tick();
    handler(second, request('valid') as never);
    await tick();
    expect(first.closed).toEqual([{ code: 4001, reason: 'connection replaced' }]);

    first.emit('close');
    await tick();
    expect(connections.agents.get('agent-1')).toBe(second);
    expect(offlineAgentIds).toEqual([]);
  });

  it('rejects heartbeat field drift and invalid message directions', async () => {
    const drifted = new FakeSocket();
    const direction = new FakeSocket();
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      {
        path: '/agent',
        requireTls: true,
        maxMessageBytes: 1_048_576,
        service: createService(),
        connections: new FakeConnections(),
      },
    );

    handler(drifted, request('valid') as never);
    await tick();
    drifted.emitMessage(message('heartbeat', {
      status: 'online',
      models: [{ model: 'llama3:8b', state: 'ready' }],
    }));
    await tick();
    expect(drifted.closed[0]).toEqual({ code: 1003, reason: 'invalid heartbeat' });

    handler(direction, request('valid') as never);
    await tick();
    direction.emitMessage(message('heartbeat_ack', {}));
    await tick();
    expect(direction.closed[0]).toEqual({
      code: 1003,
      reason: 'invalid message direction',
    });
  });

  it('closes stale connections and persists offline status', async () => {
    const socket = new FakeSocket();
    const connections = new InMemoryConnectionRegistry();
    const offlineAgentIds: string[] = [];
    connections.add('agent-1', socket);
    connections.touch('agent-1', socket, 1_000);
    const monitor = new AgentHeartbeatMonitor(
      connections,
      createService({
        markOffline: async (agentId) => {
          offlineAgentIds.push(agentId);
        },
      }),
      30_000,
      { warn: () => undefined },
    );

    await monitor.sweep(30_999);
    expect(socket.closed).toEqual([]);
    await monitor.sweep(31_000);
    expect(socket.closed).toEqual([{ code: 4000, reason: 'heartbeat timeout' }]);
    expect(connections.get('agent-1')).toBeUndefined();
    expect(offlineAgentIds).toEqual(['agent-1']);
  });

  it('rejects old credentials and unknown protocol fields', async () => {
    const rejected = new FakeSocket();
    const options = {
      path: '/agent',
      requireTls: true,
      maxMessageBytes: 1_048_576,
      service: createService(),
      connections: new FakeConnections(),
    };
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      options,
    );
    handler(rejected, request('old') as never);
    await tick();
    expect(rejected.closed[0]).toEqual({ code: 1008, reason: 'credential rejected' });

    const invalid = new FakeSocket();
    handler(invalid, request() as never);
    invalid.emitMessage({ ...message('heartbeat', { models: [] }), secret: 'leak' });
    await tick();
    expect(invalid.closed[0]).toEqual({ code: 1003, reason: 'invalid message' });
  });

  it('rejects oversized messages', async () => {
    const socket = new FakeSocket();
    const handler = createAgentConnectionHandler(
      { log: { warn: () => undefined } } as never,
      {
        path: '/agent',
        requireTls: true,
        maxMessageBytes: 10,
        service: createService(),
        connections: new FakeConnections(),
      },
    );
    handler(socket, request() as never);
    socket.emitMessage(message('heartbeat', { models: [] }));
    await tick();
    expect(socket.closed[0]).toEqual({ code: 1009, reason: 'message too large' });
  });
});
