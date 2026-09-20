import { apiFetch } from './client';
import type { AgentSummary } from './agent-api';

export interface GroupSummary {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  agentCount: number;
}

export interface GroupDetail extends GroupSummary {
  agents: Array<AgentSummary & { agentId?: string }>;
}

export interface ChannelSummary {
  accessId: string;
  userId: string;
  groupId: string;
  source: string;
  createdAt: string;
  channelName: string;
  channelDescription?: string | null;
  agentCount: number;
  modelCount: number;
}

export interface ChannelModels {
  channelId: string;
  channelName: string;
  models: Array<{
    name: string;
    engine: string;
    state: string;
    agentCount: number;
  }>;
}

export interface InviteTokenResult {
  token: string;
}

export interface AcceptInviteResult {
  groupId: string;
  channelName: string;
}

export const groupApi = {
  // 分组管理
  list(): Promise<GroupSummary[]> {
    return apiFetch<GroupSummary[]>('/api/groups');
  },
  get(id: string): Promise<GroupDetail> {
    return apiFetch<GroupDetail>(`/api/groups/${id}`);
  },
  create(input: { name: string; description?: string | null }): Promise<GroupSummary> {
    return apiFetch<GroupSummary>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: { name: string; description?: string | null }): Promise<void> {
    return apiFetch<void>(`/api/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  remove(id: string): Promise<void> {
    return apiFetch<void>(`/api/groups/${id}`, { method: 'DELETE' });
  },
  addAgent(id: string, agentId: string): Promise<void> {
    return apiFetch<void>(`/api/groups/${id}/agents`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  },
  removeAgent(id: string, agentId: string): Promise<void> {
    return apiFetch<void>(`/api/groups/${id}/agents/${agentId}`, { method: 'DELETE' });
  },
  createInviteToken(id: string): Promise<InviteTokenResult> {
    return apiFetch<InviteTokenResult>(`/api/groups/${id}/invite-tokens`, { method: 'POST' });
  },
  // 渠道管理
  listChannels(): Promise<ChannelSummary[]> {
    return apiFetch<ChannelSummary[]>('/api/channels');
  },
  addChannel(token: string): Promise<AcceptInviteResult> {
    return apiFetch<AcceptInviteResult>('/api/channels', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  removeChannel(accessId: string): Promise<void> {
    return apiFetch<void>(`/api/channels/${accessId}`, { method: 'DELETE' });
  },
  listChannelModels(): Promise<ChannelModels[]> {
    return apiFetch<ChannelModels[]>('/api/channels/models');
  },
};
