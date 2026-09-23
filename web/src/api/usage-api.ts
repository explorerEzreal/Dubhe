import { apiFetch } from './client';
import type {
  MonitoringData,
  UsageAnalyticsResponse,
  UsageQueryParams,
  UsageRecord,
  UsageRecordFacets,
  UsageRecordPage,
  UsageSummary,
} from '../features/usage/types';

export type {
  MonitoringData,
  UsageAnalyticsResponse,
  UsageQueryParams,
  UsageRecord,
  UsageRecordFacets,
  UsageRecordPage,
  UsageSummary,
};

const queryString = (input: UsageQueryParams): string => {
  const query = new URLSearchParams();
  if (input.from) query.set('created_at_from', input.from);
  if (input.to) query.set('created_at_to', input.to);
  if (input.granularity) query.set('granularity', input.granularity);
  if (input.page) query.set('page', String(input.page));
  if (input.pageSize) query.set('page_size', String(input.pageSize));
  if (input.includeFacets) query.set('include', 'facets');
  input.status?.forEach((value) => query.append('status', value));
  input.modelIds?.forEach((value) => query.append('model_ids', value));
  input.deviceIds?.forEach((value) => query.append('device_ids', value));
  input.groupIds?.forEach((value) => query.append('group_ids', value));
  input.userIds?.forEach((value) => query.append('user_ids', value));
  return query.toString();
};

export const usageApi = {
  records(input: UsageQueryParams = {}): Promise<UsageRecordPage> {
    const query = queryString(input);
    return apiFetch<UsageRecordPage>(`/api/usage-records${query ? `?${query}` : ''}`);
  },

  async analytics(input: UsageQueryParams = {}): Promise<UsageAnalyticsResponse> {
    const query = queryString(input);
    const data = await apiFetch<UsageAnalyticsResponse>(`/api/usage-analytics${query ? `?${query}` : ''}`);
    return {
      ...data,
      granularity: data.granularity ?? input.granularity ?? 'day',
      requests: data.requests ?? [],
      breakdowns: {
        ...data.breakdowns,
        apiKeys: data.breakdowns.apiKeys ?? [],
      },
      dataQuality: {
        missingTokenCalls: data.dataQuality?.missingTokenCalls ?? 0,
        ungroupedCalls: data.dataQuality?.ungroupedCalls ?? 0,
        firstTokenLatencyMissing: data.dataQuality?.firstTokenLatencyMissing ?? 0,
        truncated: data.dataQuality?.truncated ?? false,
      },
    };
  },
};

export function toMonitoringData(data: UsageAnalyticsResponse): MonitoringData {
  const overview = data.overview;
  const users = data.breakdowns.users.map((item) => ({
    ...item,
    email: item.name,
    lastUsedAt: '',
    avgLatencyMs: item.avgLatencyMs ?? null,
  }));
  const groups = data.breakdowns.groups;
  const models = data.breakdowns.models;
  const devices = data.breakdowns.devices;
  const apiKeys = data.breakdowns.apiKeys ?? [];
  const summary: UsageSummary = {
    totalCalls: overview.totalCalls,
    totalTokens: overview.totalTokens,
    inputTokens: overview.inputTokens,
    outputTokens: overview.outputTokens,
    errorRate: overview.errorRate,
    avgLatencyMs: overview.avgLatencyMs,
  };
  return {
    ...summary,
    overview,
    todayOverview: data.todayOverview ?? summary,
    trend: data.trend,
    groups,
    users,
    apiKeys,
    models,
    agents: devices,
    devices,
    requests: data.requests ?? [],
    generatedAt: data.generatedAt,
    dataQuality: data.dataQuality,
    granularity: data.granularity,
  };
}
