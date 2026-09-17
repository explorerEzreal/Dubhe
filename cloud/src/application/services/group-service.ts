import type {
  AuditRepository,
  GroupRepository,
  SecurityService,
} from '../ports.js';
import { errors } from '../../domain/common/index.js';

export class GroupService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly audits: AuditRepository,
    private readonly security: SecurityService,
  ) {}

  async create(userId: string, name: string, description: string | null): Promise<Record<string, unknown>> {
    try {
      const group = await this.groups.create(userId, name, description);
      await this.audits.record(userId, 'group.create', `group:${String(group.id)}`);
      return group;
    } catch (error) {
      throw error;
    }
  }

  async list(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.groups.listByOwner(userId);
    } catch (error) {
      throw error;
    }
  }

  async get(userId: string, groupId: string): Promise<Record<string, unknown>> {
    try {
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      if (String((group as Record<string, unknown>).userId) !== userId) throw errors.forbidden();
      const agents = await this.groups.listAgentsByGroup(groupId);
      return { ...group, agents };
    } catch (error) {
      throw error;
    }
  }

  async update(userId: string, groupId: string, name: string, description: string | null): Promise<void> {
    try {
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      if (String((group as Record<string, unknown>).userId) !== userId) throw errors.forbidden();
      await this.groups.update(groupId, name, description);
      await this.audits.record(userId, 'group.update', `group:${groupId}`);
    } catch (error) {
      throw error;
    }
  }

  async delete(userId: string, groupId: string): Promise<void> {
    try {
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      if (String((group as Record<string, unknown>).userId) !== userId) throw errors.forbidden();
      const keyCount = await this.groups.countApiKeys(groupId);
      if (keyCount > 0) throw errors.conflict('该分组下存在活跃 API Key，请先删除关联 API Key');
      await this.groups.delete(groupId);
      await this.audits.record(userId, 'group.delete', `group:${groupId}`);
    } catch (error) {
      throw error;
    }
  }

  async addAgent(userId: string, groupId: string, agentId: string): Promise<void> {
    try {
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      if (String((group as Record<string, unknown>).userId) !== userId) throw errors.forbidden();
      await this.groups.addAgent(groupId, agentId);
      await this.audits.record(userId, 'group.add-agent', `group:${groupId} agent:${agentId}`);
    } catch (error) {
      throw error;
    }
  }

  async removeAgent(userId: string, groupId: string, agentId: string): Promise<void> {
    try {
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      if (String((group as Record<string, unknown>).userId) !== userId) throw errors.forbidden();
      await this.groups.removeAgent(groupId, agentId);
      await this.audits.record(userId, 'group.remove-agent', `group:${groupId} agent:${agentId}`);
    } catch (error) {
      throw error;
    }
  }

  async createInviteToken(userId: string, groupId: string): Promise<string> {
    try {
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      if (String((group as Record<string, unknown>).userId) !== userId) throw errors.forbidden();
      // 签发 JWT，有效期 7 天
      const token = this.security.signPayload({ groupId, issuerId: userId }, 604800);
      return token;
    } catch (error) {
      throw error;
    }
  }

  async acceptInvite(userId: string, token: string): Promise<Record<string, unknown>> {
    try {
      const decoded = this.security.verifyPayload(token);
      if (!decoded) throw errors.invalidRequest('INVITE_INVALID', '邀请码无效或已过期');
      const { groupId, issuerId } = decoded as { groupId: string; issuerId: string };
      if (!groupId || !issuerId) throw errors.invalidRequest('INVITE_INVALID', '邀请码无效或已过期');
      if (issuerId === userId) throw errors.invalidRequest('INVITE_SELF', '不能添加自己的分组');
      const group = await this.groups.getById(groupId);
      if (!group) throw errors.notFound();
      await this.groups.addAccess(userId, groupId, 'invited');
      await this.audits.record(userId, 'channel.add', `group:${groupId}`);
      return { groupId, channelName: String((group as Record<string, unknown>).name) };
    } catch (error) {
      throw error;
    }
  }

  // 渠道方法
  async listChannels(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.groups.listAccessByUser(userId);
    } catch (error) {
      throw error;
    }
  }

  async removeChannel(userId: string, accessId: string): Promise<void> {
    try {
      if (!(await this.groups.removeAccess(userId, accessId))) throw errors.notFound();
      await this.audits.record(userId, 'channel.remove', `access:${accessId}`);
    } catch (error) {
      throw error;
    }
  }

  async listChannelModels(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const channels = await this.groups.listAccessByUser(userId);
      const result = [];
      for (const ch of channels) {
        const groupId = String((ch as Record<string, unknown>).groupId);
        const agents = await this.groups.listAgentsByGroup(groupId);
        // 收集所有 agent 上的模型
        const modelSet = new Map<string, { name: string; engine: string; state: string; agentCount: number }>();
        for (const agent of agents) {
          const instances = (agent as Record<string, unknown>).modelInstances as Array<Record<string, unknown>> || [];
          for (const inst of instances) {
            const name = String(inst.name);
            if (modelSet.has(name)) {
              const existing = modelSet.get(name)!;
              if (inst.state === 'ready') existing.agentCount += 1;
            } else {
              modelSet.set(name, {
                name,
                engine: String(inst.engine),
                state: String(inst.state),
                agentCount: inst.state === 'ready' ? 1 : 0,
              });
            }
          }
        }
        result.push({
          channelId: String((ch as Record<string, unknown>).accessId),
          channelName: String((ch as Record<string, unknown>).channelName),
          models: Array.from(modelSet.values()),
        });
      }
      return result;
    } catch (error) {
      throw error;
    }
  }
}
