import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import type { UsageDateRange, UsageFilters, UsageQueryParams } from '../types';

export type UsageRangeKey = UsageDateRange['key'];

function resolveRange(range: UsageDateRange): [Dayjs, Dayjs] {
  const end = dayjs();
  const stableEnd = end.endOf('day');
  if (range.key === 'today') return [end.startOf('day'), stableEnd];
  if (range.key === '7d') return [end.subtract(6, 'day').startOf('day'), stableEnd];
  if (range.key === '30d') return [end.subtract(29, 'day').startOf('day'), stableEnd];
  return range.custom;
}

export function useUsageQueryState(options: { initialRange?: UsageRangeKey; initialPageSize?: number } = {}) {
  const [range, setRange] = useState<UsageDateRange>({
    key: options.initialRange ?? '30d',
    custom: [dayjs().subtract(29, 'day'), dayjs()],
  });
  const [filters, setFilters] = useState<UsageFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options.initialPageSize ?? 20);
  const [from, to] = resolveRange(range);

  const query = useMemo<UsageQueryParams>(() => ({
    from: from.startOf('day').toISOString(),
    to: to.endOf('day').toISOString(),
    status: filters.status ? [filters.status] : undefined,
    modelIds: filters.modelId ? [filters.modelId] : undefined,
    groupIds: filters.groupId ? [filters.groupId] : undefined,
    deviceIds: filters.deviceId ? [filters.deviceId] : undefined,
    userIds: filters.userId ? [filters.userId] : undefined,
  }), [filters, from, to]);

  const updateFilters = useCallback((next: UsageFilters) => {
    setFilters(next);
    setPage(1);
  }, []);
  const updateRange = useCallback((key: UsageRangeKey) => {
    setRange((current) => ({ ...current, key }));
    setPage(1);
  }, []);
  const updateCustomRange = useCallback((custom: [Dayjs, Dayjs]) => {
    setRange({ key: 'custom', custom });
    setPage(1);
  }, []);
  const updatePage = useCallback((nextPage: number, nextPageSize: number) => {
    setPage(nextPage);
    setPageSize(nextPageSize);
  }, []);
  const resetFilters = useCallback(() => updateFilters({}), [updateFilters]);

  return {
    rangeKey: range.key,
    customRange: range.custom,
    filters,
    page,
    pageSize,
    query,
    updateFilters,
    updateRange,
    updateCustomRange,
    updatePage,
    resetFilters,
  };
}
