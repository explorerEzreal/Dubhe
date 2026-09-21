import { apiFetch } from './client';

export interface UsageSummary {
  totalCalls: number;
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorRate: number;
  avgLatencyMs: number | null;
}

export interface UsageRecord {
  id: string;
  requestId: string;
  createdAt: string;
  userId: string;
  userName?: string;
  groupId: string | null;
  groupName: string;
  groupDeleted?: boolean;
  deviceId: string | null;
  deviceName: string;
  modelId: string | null;
  modelName: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  firstTokenLatencyMs: number | null;
  durationMs: number | null;
  reasoningEffort: 'low' | 'medium' | 'high' | null;
}

export interface UsageRecordPage {
  items: UsageRecord[];
  page: number;
  pageSize: number;
  total: number;
  facets?: { statuses: string[]; models: Array<{ id: string; name: string }>; devices: Array<{ id: string; name: string }>; groups: Array<{ id: string; name: string; deleted: boolean }>; users?: Array<{ id: string; name: string }> };
}
export type UsageRecordFacets = NonNullable<UsageRecordPage['facets']>;

export interface MonitoringData extends UsageSummary {
  overview: UsageSummary & { p50LatencyMs: number; p95LatencyMs: number; missingTokenCalls: number; activeUsers: number; activeApiKeys: number; activeDevices?: number; totalDevices?: number; lastRequestAt: string | null };
  todayOverview: UsageSummary;
  trend: Array<{ date: string; totalCalls: number; totalTokens: number | null; errorRate: number }>;
  groups: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  users: Array<{ id: string; email: string; groupId: string | null; groupName: string; totalCalls: number; totalTokens: number | null; avgLatencyMs: number | null; lastUsedAt: string }>;
  apiKeys: Array<{ id: string | null; prefix: string; groupId: string | null; totalCalls: number; totalTokens: number }>;
  models: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  agents: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  devices: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>;
  requests: Array<Record<string, unknown>>;
  generatedAt: string;
  dataQuality: { missingTokenCalls: number; ungroupedCalls: number; firstTokenLatencyMissing: number; truncated: boolean };
  granularity: 'hour' | 'day';
}

type QueryInput = { from?: string; to?: string; granularity?: 'hour' | 'day'; page?: number; pageSize?: number; include?: boolean; status?: string[]; modelIds?: string[]; deviceIds?: string[]; groupIds?: string[]; userIds?: string[] };
const queryString = (input: QueryInput) => {
  const query = new URLSearchParams();
  if (input.from) query.set('created_at_from', input.from);
  if (input.to) query.set('created_at_to', input.to);
  if (input.granularity) query.set('granularity', input.granularity);
  if (input.page) query.set('page', String(input.page));
  if (input.pageSize) query.set('page_size', String(input.pageSize));
  if (input.include) query.set('include', 'facets');
  input.status?.forEach((value) => query.append('status', value));
  input.modelIds?.forEach((value) => query.append('model_ids', value));
  input.deviceIds?.forEach((value) => query.append('device_ids', value));
  input.groupIds?.forEach((value) => query.append('group_ids', value));
  input.userIds?.forEach((value) => query.append('user_ids', value));
  return query.toString();
};

export const usageApi = {
  records(input: QueryInput = {}): Promise<UsageRecordPage> {
    const query = queryString(input);
    return apiFetch<UsageRecordPage>(`/api/usage-records${query ? `?${query}` : ''}`);
  },
  analytics(input: QueryInput | string = {}, from?: string, to?: string, granularity: 'hour' | 'day' = 'day'): Promise<MonitoringData> {
    const normalized: QueryInput = typeof input === 'string'
      ? (input === 'caller' || input === 'deployer'
        ? { from, to, granularity }
        : { from: input, to: from, granularity: to === 'hour' ? 'hour' : 'day' })
      : input;
    const query = queryString(normalized);
    return apiFetch<Record<string, unknown>>(`/api/usage-analytics${query ? `?${query}` : ''}`).then((data) => {
      const overview = (data.overview ?? {}) as UsageSummary & Record<string, unknown>;
      const breakdowns = (data.breakdowns ?? {}) as Record<string, Array<Record<string, unknown>>>;
      const map = (items: Array<Record<string, unknown>> = []) => items.map((item) => ({ id: (item.id as string | null) ?? null, name: String(item.name ?? '未知'), totalCalls: Number(item.totalCalls ?? 0), totalTokens: Number(item.totalTokens ?? 0) }));
      return { totalCalls: Number(overview.totalCalls ?? 0), totalTokens: Number(overview.totalTokens ?? 0), inputTokens: Number(overview.inputTokens ?? 0), outputTokens: Number(overview.outputTokens ?? 0), errorRate: Number(overview.errorRate ?? 0), avgLatencyMs: Number(overview.avgLatencyMs ?? 0), overview: { ...overview, totalCalls: Number(overview.totalCalls ?? 0), totalTokens: Number(overview.totalTokens ?? 0), inputTokens: Number(overview.inputTokens ?? 0), outputTokens: Number(overview.outputTokens ?? 0), errorRate: Number(overview.errorRate ?? 0), avgLatencyMs: Number(overview.avgLatencyMs ?? 0), p50LatencyMs: Number(overview.p50LatencyMs ?? 0), p95LatencyMs: Number(overview.p95LatencyMs ?? 0), missingTokenCalls: Number(overview.missingTokenCalls ?? 0), activeUsers: Number(overview.activeUsers ?? 0), activeApiKeys: Number(overview.activeApiKeys ?? 0), activeDevices: Number(overview.activeDevices ?? 0), totalDevices: Number(overview.activeDevices ?? 0), lastRequestAt: (overview.lastRequestAt as string | null) ?? null }, todayOverview: { totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, errorRate: 0, avgLatencyMs: 0 }, trend: (data.trend ?? []) as MonitoringData['trend'], groups: map(breakdowns.groups), users: map(breakdowns.users).map((item) => ({ ...item, email: item.name, groupId: null, groupName: '未分组', avgLatencyMs: null, lastUsedAt: '' })), apiKeys: [], models: map(breakdowns.models), agents: map(breakdowns.devices), devices: map(breakdowns.devices), requests: [], generatedAt: String(data.generatedAt ?? new Date().toISOString()), dataQuality: { missingTokenCalls: Number((data.dataQuality as Record<string, unknown> | undefined)?.missingTokenCalls ?? 0), ungroupedCalls: Number((data.dataQuality as Record<string, unknown> | undefined)?.ungroupedCalls ?? 0), firstTokenLatencyMissing: Number((data.dataQuality as Record<string, unknown> | undefined)?.firstTokenLatencyMissing ?? 0), truncated: false }, granularity: normalized.granularity ?? 'day' } as MonitoringData;
    });
  },
};
