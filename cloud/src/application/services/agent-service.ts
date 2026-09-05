import type {
  AgentHeartbeatInput,
  AgentIdentity,
  AgentRepository,
  AuditRepository,
  ConnectionRegistry,
  SecurityService,
} from '../ports.js';
import { errors } from '../../domain/common/index.js';

export interface RegisterAgentInput {
  token: string;
  deviceId: string;
  name: string;
  hardwareInfo: Record<string, unknown> | null;
}

export class AgentService {
  constructor(
    private readonly agents: AgentRepository,
    private readonly audits: AuditRepository,
    private readonly connections: ConnectionRegistry,
    private readonly security: SecurityService,
  ) {}

  async list(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.agents.listByUser(userId);
    } catch (error) {
      throw error;
    }
  }

  async get(userId: string, agentId: string): Promise<Record<string, unknown>> {
    try {
      const agent = await this.agents.findByUser(userId, agentId);
      if (!agent) throw errors.notFound();
      return agent;
    } catch (error) {
      throw error;
    }
  }

  async authenticateCredential(credential: string): Promise<AgentIdentity> {
    try {
      const agent = await this.agents.authenticateCredential(
        this.security.digest(credential),
      );
      if (!agent) throw errors.unauthorized();
      return agent;
    } catch (error) {
      throw error;
    }
  }

  async register(input: RegisterAgentInput): Promise<{
    agentId: string;
    credential: string;
  }> {
    try {
      const credential = this.security.randomToken('dsh_cred_');
      const registered = await this.agents.register({
        ...input,
        tokenHash: this.security.digest(input.token),
        credentialHash: this.security.digest(credential),
      });
      if (!registered) throw errors.unauthorized();
      this.connections.closeAgent(
        registered.agentId,
        4001,
        'credential replaced',
      );
      await this.audits.record(
        registered.userId,
        'agent.register',
        `agent:${registered.agentId}`,
      );
      return { agentId: registered.agentId, credential };
    } catch (error) {
      throw error;
    }
  }

  async rotateCredential(
    userId: string,
    agentId: string,
  ): Promise<{ credential: string; previousCount: number }> {
    try {
      const credential = this.security.randomToken('dsh_cred_');
      const previousCount = await this.agents.rotateCredential(
        userId,
        agentId,
        this.security.digest(credential),
      );
      if (previousCount === null) throw errors.notFound();
      this.connections.closeAgent(agentId, 4001, 'credential rotated');
      await this.audits.record(
        userId,
        'agent.credential.rotate',
        `agent:${agentId}`,
      );
      return { credential, previousCount };
    } catch (error) {
      throw error;
    }
  }

  async revokeCredentials(userId: string, agentId: string): Promise<void> {
    try {
      if (!(await this.agents.revokeCredentials(userId, agentId))) {
        throw errors.notFound();
      }
      this.connections.closeAgent(agentId, 4001, 'credential revoked');
      await this.audits.record(
        userId,
        'agent.credential.revoke',
        `agent:${agentId}`,
      );
    } catch (error) {
      throw error;
    }
  }

  async heartbeat(agentId: string, input: AgentHeartbeatInput): Promise<void> {
    try {
      await this.agents.heartbeat(agentId, input);
    } catch (error) {
      throw error;
    }
  }

  async markOffline(agentId: string): Promise<void> {
    try {
      await this.agents.markOffline(agentId);
    } catch (error) {
      throw error;
    }
  }
}
