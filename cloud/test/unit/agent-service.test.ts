import { describe, expect, it } from 'vitest';
import type {
  AgentHeartbeatInput,
  AgentRegistrationInput,
  AgentRepository,
  AuditRepository,
  ConnectionRegistry,
  SecurityService,
} from '../../src/application/ports.js';
import { AgentService } from '../../src/application/services/agent-service.js';

class FakeAgents implements AgentRepository {
  tokenAvailable = true;
  activeDigest = '';
  heartbeatInput?: AgentHeartbeatInput;
  offlineAgentIds: string[] = [];

  async listByUser(): Promise<Array<Record<string, unknown>>> {
    try {
      return [];
    } catch (error) {
      throw error;
    }
  }

  async findByUser(): Promise<Record<string, unknown> | null> {
    try {
      return { id: '00000000-0000-4000-8000-000000000001' };
    } catch (error) {
      throw error;
    }
  }

  async authenticateCredential(credentialHash: string) {
    try {
      return credentialHash === this.activeDigest
        ? { id: 'agent-1', userId: 'user-1', status: 'online' as const }
        : null;
    } catch (error) {
      throw error;
    }
  }

  async register(input: AgentRegistrationInput) {
    try {
      if (!this.tokenAvailable) return null;
      this.tokenAvailable = false;
      this.activeDigest = input.credentialHash;
      return { agentId: 'agent-1', userId: 'user-1' };
    } catch (error) {
      throw error;
    }
  }

  async rotateCredential(_userId: string, _agentId: string, credentialHash: string) {
    try {
      this.activeDigest = credentialHash;
      return 1;
    } catch (error) {
      throw error;
    }
  }

  async revokeCredentials(): Promise<boolean> {
    try {
      this.activeDigest = '';
      return true;
    } catch (error) {
      throw error;
    }
  }

  async heartbeat(_agentId: string, input: AgentHeartbeatInput): Promise<void> {
    try {
      this.heartbeatInput = input;
    } catch (error) {
      throw error;
    }
  }

  async markOffline(agentId: string): Promise<void> {
    this.offlineAgentIds.push(agentId);
  }
}

class FakeConnections implements ConnectionRegistry {
  closed: string[] = [];
  add(): undefined { return undefined; }
  remove(): boolean { return false; }
  closeAgent(agentId: string): void {
    this.closed.push(agentId);
  }
  get(): undefined { return undefined; }
  touch(): void {}
  getStale(): Array<{ agentId: string; socket: never }> { return []; }
}

const audits: AuditRepository = {
  record: async () => undefined,
};
const security: SecurityService = {
  hashPassword: async (value) => value,
  verifyPassword: async () => true,
  digest: (value) => `digest:${value}`,
  signSession: () => 'jwt',
  verifySession: () => null,
  randomToken: (prefix) => `${prefix}secret`,
};

describe('AgentService', () => {
  it('consumes enrollment once and invalidates old credentials on rotation', async () => {
    const agents = new FakeAgents();
    const connections = new FakeConnections();
    const service = new AgentService(agents, audits, connections, security);
    const registered = await service.register({
      token: 'enrollment',
      deviceId: 'device-1',
      name: 'Agent',
      hardwareInfo: null,
    });
    await expect(service.authenticateCredential(registered.credential)).resolves.toMatchObject({
      id: 'agent-1',
    });
    await expect(
      service.register({
        token: 'enrollment',
        deviceId: 'device-1',
        name: 'Agent',
        hardwareInfo: null,
      }),
    ).rejects.toMatchObject({ statusCode: 401 });

    const rotated = await service.rotateCredential('user-1', 'agent-1');
    expect(rotated.previousCount).toBe(1);
    expect(connections.closed).toEqual(['agent-1', 'agent-1']);
    await service.revokeCredentials('user-1', 'agent-1');
    await expect(service.authenticateCredential(rotated.credential)).rejects.toMatchObject({
      statusCode: 401,
    });
    await service.markOffline('agent-1');
    expect(agents.offlineAgentIds).toEqual(['agent-1']);
  });
});
