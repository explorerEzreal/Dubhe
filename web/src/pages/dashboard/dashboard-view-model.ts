import type { MonitoringData } from '../../api/usage-api';

export type DashboardTrend = { date: string; tokens: number; calls: number; errorRate: number };
export type DashboardDistribution = { id: string; name: string; value: number; calls: number };
export type DashboardRequest = { id: string; time: string; user: string; group: string; model: string; device: string; status: 'success' | 'warning' | 'error'; latency: number | null; tokens: number };
export type DashboardViewModel = {
  generatedAt: string;
  granularity: 'hour' | 'day';
  trend: DashboardTrend[];
  kpis: Array<{ key: string; label: string; value: string; unit: string; delta: string; tone: string }>;
  health: { todayTokens: string; activeUsers: string; activeKeys: string; p95: string; lastCall: string; inputTokens: string; outputTokens: string; inputRatio: number; errorRate: number };
  distributions: { models: DashboardDistribution[]; groups: DashboardDistribution[]; devices: DashboardDistribution[] };
  requests: DashboardRequest[];
  quality: { missingTokens: number; ungrouped: string; truncated: boolean };
};

const number = (value: number): string => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : Math.round(value).toLocaleString();
const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
const status = (value: string): DashboardRequest['status'] => value === 'completed' ? 'success' : value === 'failed' ? 'error' : 'warning';
const distribution = (items: Array<{ id: string | null; name: string; totalCalls: number; totalTokens: number }>): DashboardDistribution[] => {
  const total = items.reduce((sum, item) => sum + Number(item.totalTokens ?? 0), 0);
  return items.map((item) => ({ id: item.id ?? item.name, name: item.name || '未知', calls: Number(item.totalCalls ?? 0), value: total ? Number(((Number(item.totalTokens ?? 0) / total) * 100).toFixed(1)) : 0 }));
};

export function toDashboardViewModel(data: MonitoringData): DashboardViewModel {
  const overview = data.overview;
  const trend = data.trend.map((item) => ({ date: item.date, tokens: Number(item.totalTokens ?? 0), calls: Number(item.totalCalls ?? 0), errorRate: Number(item.errorRate ?? 0) }));
  const current = overview.totalCalls;
  const previous = trend.slice(0, Math.floor(trend.length / 2)).reduce((sum, item) => sum + item.calls, 0);
  const recent = trend.slice(Math.floor(trend.length / 2)).reduce((sum, item) => sum + item.calls, 0);
  const delta = previous ? `${recent >= previous ? '+' : ''}${(((recent / previous) - 1) * 100).toFixed(1)}%` : '—';
  const input = Number(overview.inputTokens ?? 0);
  const output = Number(overview.outputTokens ?? 0);
  const inputRatio = input + output ? Math.round((input / (input + output)) * 100) : 0;
  const devices = data.devices ?? data.agents ?? [];
  return {
    generatedAt: data.generatedAt,
    granularity: data.granularity ?? 'day',
    trend,
    kpis: [
      { key: 'calls', label: '总请求数', value: number(current), unit: '', delta, tone: 'blue' },
      { key: 'tokens', label: '总 Token', value: number(overview.totalTokens ?? 0), unit: '', delta, tone: 'green' },
      { key: 'errors', label: '错误率', value: percent(overview.errorRate).replace('%', ''), unit: '%', delta: percent(overview.errorRate), tone: 'red' },
      { key: 'latency', label: 'P95 延迟', value: number(overview.p95LatencyMs), unit: 'ms', delta: '—', tone: 'purple' },
      { key: 'devices', label: '活跃设备', value: String(overview.activeDevices ?? devices.length), unit: `/ ${overview.totalDevices ?? devices.length}`, delta: '—', tone: 'teal' },
    ],
    health: { todayTokens: number(data.todayOverview.totalTokens ?? 0), activeUsers: String(overview.activeUsers), activeKeys: String(overview.activeApiKeys), p95: `${number(overview.p95LatencyMs)} ms`, lastCall: overview.lastRequestAt ? new Date(overview.lastRequestAt).toLocaleString() : '—', inputTokens: number(input), outputTokens: number(output), inputRatio, errorRate: Number(overview.errorRate ?? 0) },
    distributions: { models: distribution(data.models), groups: distribution(data.groups), devices: distribution(devices) },
    requests: data.requests.map((item) => ({ id: String(item.requestId ?? ''), time: new Date(String(item.startedAt ?? '')).toLocaleTimeString(), user: String(item.email ?? ''), group: String(item.groupName ?? ''), model: String(item.modelName ?? ''), device: String(item.deviceName ?? item.agentName ?? '未知设备'), status: status(String(item.status ?? '')), latency: typeof item.latencyMs === 'number' ? item.latencyMs : null, tokens: Number(item.totalTokens ?? 0) })),
    quality: { missingTokens: Number(data.dataQuality.missingTokenCalls ?? 0), ungrouped: `${Number(data.dataQuality.ungroupedCalls ?? 0).toLocaleString()}`, truncated: data.dataQuality.truncated },
  };
}
