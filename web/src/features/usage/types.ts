import type { Dayjs } from 'dayjs';

export type UsageQueryParams = {
  from?: string;
  to?: string;
  granularity?: 'hour' | 'day';
  page?: number;
  pageSize?: number;
  includeFacets?: boolean;
  status?: string[];
  modelIds?: string[];
  deviceIds?: string[];
  groupIds?: string[];
  userIds?: string[];
};

export type UsageFilters = {
  status?: string;
  modelId?: string;
  groupId?: string;
  deviceId?: string;
  userId?: string;
};

export type UsageDateRange = {
  key: 'today' | '7d' | '30d' | 'custom';
  custom: [Dayjs, Dayjs];
};

export type UsageOverview = {
  totalCalls: number;
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorRate: number;
  avgLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  activeUsers: number;
  activeApiKeys: number;
  activeDevices: number;
  totalDevices?: number;
  lastRequestAt: string | null;
  missingTokenCalls?: number;
  ungroupedCalls?: number;
  firstTokenLatencyMissing?: number;
};

export type UsageSummary = Pick<UsageOverview, 'totalCalls' | 'totalTokens' | 'inputTokens' | 'outputTokens' | 'errorRate' | 'avgLatencyMs'>;

export type UsageTrendPoint = {
  date: string;
  totalCalls: number;
  totalTokens: number | null;
  errorRate: number;
};

export type UsageBreakdownItem = {
  id: string | null;
  name: string;
  totalCalls: number;
  totalTokens: number | null;
  avgLatencyMs?: number | null;
};

export type UsageUserBreakdownItem = UsageBreakdownItem & {
  groupId: string | null;
  groupName: string;
};

export type UsageApiKeyBreakdownItem = UsageBreakdownItem & {
  prefix: string;
  groupId: string | null;
};

export type UsageRequest = {
  requestId: string;
  startedAt: string;
  email?: string;
  groupName?: string;
  apiKeyPrefix?: string;
  modelName?: string;
  agentName?: string;
  deviceName?: string;
  status: string;
  errorCode?: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  endpoint?: string;
  requestBytes?: number | null;
  responseBytes?: number | null;
  upstreamStatusCode?: number | null;
  usageAvailable?: boolean | null;
};

export type UsageDataQuality = {
  missingTokenCalls: number;
  ungroupedCalls: number;
  firstTokenLatencyMissing: number;
  truncated: boolean;
};

export type UsageAnalyticsResponse = {
  overview: UsageOverview;
  todayOverview?: UsageSummary;
  trend: UsageTrendPoint[];
  breakdowns: {
    groups: UsageBreakdownItem[];
    users: UsageUserBreakdownItem[];
    models: UsageBreakdownItem[];
    devices: UsageBreakdownItem[];
    apiKeys?: UsageApiKeyBreakdownItem[];
  };
  requests?: UsageRequest[];
  dataQuality: UsageDataQuality;
  generatedAt: string;
  granularity: 'hour' | 'day';
};

export type UsageRecord = {
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
};

export type UsageRecordFacets = {
  statuses: string[];
  models: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string; deleted: boolean }>;
  users?: Array<{ id: string; name: string }>;
};

export type UsageRecordPage = {
  items: UsageRecord[];
  page: number;
  pageSize: number;
  total: number;
  facets?: UsageRecordFacets;
};

export type MonitoringData = UsageSummary & {
  overview: UsageOverview;
  todayOverview: UsageSummary;
  trend: UsageTrendPoint[];
  groups: UsageBreakdownItem[];
  users: Array<UsageUserBreakdownItem & { email: string; lastUsedAt: string; avgLatencyMs: number | null }>;
  apiKeys: UsageApiKeyBreakdownItem[];
  models: UsageBreakdownItem[];
  agents: UsageBreakdownItem[];
  devices: UsageBreakdownItem[];
  requests: UsageRequest[];
  generatedAt: string;
  dataQuality: UsageDataQuality;
  granularity: 'hour' | 'day';
};
