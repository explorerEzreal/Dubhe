import { apiFetch } from './client';

export interface UsageSummary {
  totalCalls: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  errorRate: number;
  avgLatencyMs: number;
}

export interface MonitoringData {
  overview: UsageSummary & { p50LatencyMs: number; p95LatencyMs: number; missingTokenCalls: number; activeUsers: number; activeApiKeys: number; activeDevices?: number; totalDevices?: number; lastRequestAt: string | null };
  todayOverview: { totalCalls: number; totalTokens: number; errorRate: number };
  trend: Array<{ date: string; totalCalls: number; totalTokens: number; errorRate: number }>;
  groups: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  users: Array<{ id: string; email: string; groupId: string | null; groupName: string; totalCalls: number; totalTokens: number; avgLatencyMs: number; lastUsedAt: string }>;
  apiKeys: Array<{ id: string | null; prefix: string; groupId: string | null; totalCalls: number; totalTokens: number }>;
  models: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  agents: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  devices?: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  requests: Array<{ requestId: string; startedAt: string; email: string; groupName: string; apiKeyPrefix: string; modelName: string; agentName?: string; deviceName?: string; status: string; errorCode: string | null; inputTokens: number | null; outputTokens: number | null; totalTokens: number; latencyMs: number | null }>;
  generatedAt: string;
  dataQuality: { missingTokenCalls: number; ungroupedCalls: number; truncated: boolean };
  granularity?: 'hour' | 'day';
}

export const usageApi = {
  summary(): Promise<UsageSummary> {
      return apiFetch<UsageSummary>('/api/usage');
  },
  monitoring(scopeOrFrom?: 'caller' | 'deployer' | string, fromOrTo?: string, toOrGranularity?: string, requestedGranularity: 'hour' | 'day' = 'day'): Promise<MonitoringData> {
    const query = new URLSearchParams();
    const legacy = scopeOrFrom === 'caller' || scopeOrFrom === 'deployer';
    const from = legacy ? fromOrTo : scopeOrFrom;
    const to = legacy ? toOrGranularity : fromOrTo;
    const granularity = legacy ? requestedGranularity : (toOrGranularity === 'hour' ? 'hour' : 'day');
    query.set('granularity', granularity);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return apiFetch<MonitoringData>(`/api/monitoring${query.toString() ? `?${query.toString()}` : ''}`);
  },
};
