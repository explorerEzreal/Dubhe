import type { UsageRecordFacets } from '../../api/usage-api';

/** 筛选条件：与后端 records 接口查询参数一一对应 */
export type RecordFilters = {
  status?: string;
  modelId?: string;
  groupId?: string;
  deviceId?: string;
  userId?: string;
};

/** 时间范围快捷选择 */
export type RangeKey = 'today' | '7d' | '30d' | 'custom';

export type ToneKind = 'success' | 'error' | 'warning' | 'processing' | 'neutral';

export type StatusMeta = { label: string; tone: ToneKind };

/**
 * 后端状态值在不同阶段出现过 completed / failed，这里统一兼容。
 * 未知状态直接回退为原始字符串，避免吞掉信息。
 */
const STATUS_TEXT: Record<string, string> = {
  success: '成功',
  ok: '成功',
  completed: '成功',
  succeeded: '成功',
  error: '失败',
  failed: '失败',
  failure: '失败',
  timeout: '超时',
  timed_out: '超时',
  rate_limited: '限流',
  throttled: '限流',
  cancelled: '已取消',
  canceled: '已取消',
  aborted: '已取消',
  pending: '进行中',
  running: '进行中',
  streaming: '进行中',
};

const STATUS_TONE: Record<string, ToneKind> = {
  success: 'success',
  ok: 'success',
  completed: 'success',
  succeeded: 'success',
  error: 'error',
  failed: 'error',
  failure: 'error',
  timeout: 'warning',
  timed_out: 'warning',
  rate_limited: 'warning',
  throttled: 'warning',
  cancelled: 'neutral',
  canceled: 'neutral',
  aborted: 'neutral',
  pending: 'processing',
  running: 'processing',
  streaming: 'processing',
};

export function statusMeta(status: string): StatusMeta {
  const key = String(status ?? '').toLowerCase();
  return { label: STATUS_TEXT[key] ?? status ?? '—', tone: STATUS_TONE[key] ?? 'neutral' };
}

export const EFFORT_TEXT: Record<string, string> = { low: '低', medium: '中', high: '高' };

export function effortLabel(value: string | null): string {
  if (!value) return '—';
  return EFFORT_TEXT[value.toLowerCase()] ?? value;
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Math.round(value).toLocaleString('zh-CN');
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return Math.round(value).toLocaleString('zh-CN');
}

export function formatMs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatFullDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 合并两次请求返回的 facets，保证翻页/改筛选后下拉选项只会变多不会变少。
 * 原实现只在 page === 1 时请求 facets，翻页后下拉会清空。
 */
export function mergeFacets(previous: UsageRecordFacets | null, next: UsageRecordFacets | null): UsageRecordFacets | null {
  if (!next) return previous;
  if (!previous) return next;
  const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    [...a, ...b].forEach((item) => map.set(item.id, item));
    return [...map.values()];
  };
  return {
    statuses: [...new Set([...previous.statuses, ...next.statuses])],
    models: byId(previous.models, next.models),
    devices: byId(previous.devices, next.devices),
    groups: byId(previous.groups, next.groups),
    users: byId(previous.users ?? [], next.users ?? []),
  };
}

export function isEmptyFilters(filters: RecordFilters): boolean {
  return !filters.status && !filters.modelId && !filters.groupId && !filters.deviceId && !filters.userId;
}
