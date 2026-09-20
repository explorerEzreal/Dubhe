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
  overview: UsageSummary & { p50LatencyMs: number; p95LatencyMs: number; missingTokenCalls: number; activeUsers: number; activeApiKeys: number; lastRequestAt: string | null };
  todayOverview: { totalCalls: number; totalTokens: number; errorRate: number };
  trend: Array<{ date: string; totalCalls: number; totalTokens: number }>;
  groups: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  users: Array<{ id: string; email: string; groupId: string | null; groupName: string; totalCalls: number; totalTokens: number; avgLatencyMs: number; lastUsedAt: string }>;
  apiKeys: Array<{ id: string | null; prefix: string; groupId: string | null; totalCalls: number; totalTokens: number }>;
  models: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  agents: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  requests: Array<{ requestId: string; startedAt: string; email: string; groupName: string; apiKeyPrefix: string; modelName: string; agentName: string; status: string; errorCode: string | null; inputTokens: number | null; outputTokens: number | null; totalTokens: number; latencyMs: number | null }>;
  generatedAt: string;
  dataQuality: { missingTokenCalls: number; ungroupedCalls: number; truncated: boolean };
}

export const usageApi = {
  summary(): Promise<UsageSummary> {
      return apiFetch<UsageSummary>('/api/usage');
  },
  monitoring(scope: 'caller' | 'deployer', from?: string, to?: string): Promise<MonitoringData> {
    const query = new URLSearchParams();
    query.set('scope', scope);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return apiFetch<MonitoringData>(`/api/monitoring${query.toString() ? `?${query.toString()}` : ''}`);
  },
};
