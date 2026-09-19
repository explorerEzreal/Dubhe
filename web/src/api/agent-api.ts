import { apiFetch } from './client';

export interface AgentSummary {
  id: string;
  name?: string;
  status: string;
  statusReason?: string;
  lastSeenAt?: string;
  resourceSnapshotAt?: string;
  hardwareInfo?: Record<string, unknown> | null;
  modelInstances: ModelInstanceSummary[];
}

export interface ModelInstanceSummary {
  name: string;
  engine: string;
  state: string;
  maxConcurrency: number;
  lastError?: string | null;
  lastReadyAt?: string | null;
}

export const agentApi = {
  list(): Promise<AgentSummary[]> {
    return apiFetch<AgentSummary[]>('/api/agents');
  },
  get(id: string): Promise<AgentSummary> {
    return apiFetch<AgentSummary>(`/api/agents/${id}`);
  },
  rename(id: string, name: string): Promise<AgentSummary> {
    return apiFetch<AgentSummary>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },
  rotate(id: string): Promise<{ credential: string; previousCount: number }> {
    return apiFetch<{ credential: string; previousCount: number }>(`/api/agents/${id}/credentials/rotate`, { method: 'POST' });
  },
  revoke(id: string): Promise<void> {
    return apiFetch<void>(`/api/agents/${id}/credentials/revoke`, { method: 'POST' });
  },
};
